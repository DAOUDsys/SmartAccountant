import { Inject, Injectable } from '@nestjs/common';
import {
  JournalEntryStatus,
  Prisma,
  TransactionStatus,
  type Transaction,
  type TransactionType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { validateJournalLinesBalanced } from '../journals/validators/journal-balancing';
import { ReversalSource, type ReverseTransactionDto } from './dto/reverse-transaction.dto';
import { reversalConflict, reversalNotFound } from './reversal.errors';
import { buildReversalPreview } from './reversal-preview.builder';
import type {
  OriginalJournalEntryForReversal,
  ReversalJournalEntryForResponse,
  ReverseTransactionResponse,
} from './reversal-preview.types';
import {
  assertOriginalJournalCanBeReversed,
  requireReversalDate,
  requireReversalIdempotencyKey,
  requireReversalReason,
} from './reversal-validators';

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

@Injectable()
export class ReversalService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async reverseTransaction(
    businessId: string,
    transactionId: string,
    userId: string,
    dto: ReverseTransactionDto,
  ): Promise<ReverseTransactionResponse> {
    const reason = requireReversalReason(dto.reason);
    const reversalDate = requireReversalDate(dto.reversalDate);
    const idempotencyKey = requireReversalIdempotencyKey(dto.idempotencyKey);
    const source = dto.source ?? ReversalSource.MANUAL;

    const existingByKey = await this.findReversalByIdempotencyKey(businessId, idempotencyKey);
    if (existingByKey) {
      return this.returnIdempotentReversal(
        existingByKey,
        transactionId,
        reason,
        reversalDate,
        source,
      );
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existingInsideTransaction = await this.findReversalByIdempotencyKey(
            businessId,
            idempotencyKey,
            tx,
          );

          if (existingInsideTransaction) {
            return this.returnIdempotentReversal(
              existingInsideTransaction,
              transactionId,
              reason,
              reversalDate,
              source,
            );
          }

          const transaction = await this.findTransaction(tx, businessId, transactionId);
          const originalJournal = await this.resolveOriginalJournal(tx, businessId, transaction.id);

          if (transaction.status !== TransactionStatus.POSTED) {
            this.throwNonPostedTransactionError(originalJournal);
          }

          assertOriginalJournalCanBeReversed(businessId, originalJournal);

          const preview = buildReversalPreview(originalJournal);
          validateJournalLinesBalanced(preview.lines);

          const reversedAt = new Date();
          const description = this.reversalDescription(originalJournal.id, transaction.id, source);
          const reversalJournal = await tx.journalEntry.create({
            data: {
              businessId,
              createdById: userId,
              description,
              idempotencyKey,
              lines: {
                create: preview.lines.map((line) => ({
                  accountId: line.accountId,
                  creditAmount: line.creditAmount,
                  debitAmount: line.debitAmount,
                  description: line.description,
                })),
              },
              postedAt: reversedAt,
              postingDate: new Date(reversalDate),
              reversalReason: reason,
              reversesJournalEntryId: originalJournal.id,
              sourceTransactionId: transaction.id,
              status: JournalEntryStatus.POSTED,
            },
            include: this.reversalJournalInclude(),
          });

          const originalUpdate = await tx.journalEntry.updateMany({
            data: {
              reversedAt,
              reversedById: userId,
              status: JournalEntryStatus.REVERSED,
            },
            where: {
              businessId,
              id: originalJournal.id,
              status: JournalEntryStatus.POSTED,
            },
          });

          if (originalUpdate.count !== 1) {
            throw reversalConflict(
              'REVERSAL_CONCURRENT_CONFLICT',
              'Original journal changed during reversal. Please retry.',
            );
          }

          const transactionUpdate = await tx.transaction.updateMany({
            data: {
              status: TransactionStatus.VOIDED,
              voidReason: reason,
              voidedAt: reversedAt,
              voidedById: userId,
            },
            where: {
              businessId,
              id: transaction.id,
              status: TransactionStatus.POSTED,
            },
          });

          if (transactionUpdate.count !== 1) {
            throw reversalConflict(
              'REVERSAL_CONCURRENT_CONFLICT',
              'Source transaction changed during reversal. Please retry.',
            );
          }

          return this.toReverseResponse(
            reversalJournal,
            originalJournal.id,
            transaction,
            reason,
            reversalDate,
            preview.warnings,
            reversedAt,
          );
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const existingAfterConflict = await this.findReversalByIdempotencyKey(
            businessId,
            idempotencyKey,
          );

          if (existingAfterConflict) {
            return this.returnIdempotentReversal(
              existingAfterConflict,
              transactionId,
              reason,
              reversalDate,
              source,
            );
          }

          throw reversalConflict(
            'REVERSAL_ALREADY_COMPLETED',
            'This posted journal already has a reversal.',
          );
        }

        if (error.code === 'P2034') {
          throw reversalConflict(
            'REVERSAL_CONCURRENT_CONFLICT',
            'Concurrent reversal conflict. Please retry with the same idempotency key.',
          );
        }
      }

      throw error;
    }
  }

  private async returnIdempotentReversal(
    reversalJournal: ReversalJournalEntryForResponse,
    transactionId: string,
    reason: string,
    reversalDate: string,
    source: ReversalSource,
  ): Promise<ReverseTransactionResponse> {
    if (
      !reversalJournal.reversesJournalEntryId ||
      reversalJournal.sourceTransactionId !== transactionId ||
      reversalJournal.status !== JournalEntryStatus.POSTED
    ) {
      throw reversalConflict(
        'REVERSAL_IDEMPOTENCY_CONFLICT',
        'Idempotency key is already used for another operation.',
      );
    }

    if (
      reversalJournal.reversalReason !== reason ||
      !this.sameDate(reversalJournal.postingDate, reversalDate) ||
      reversalJournal.description !==
        this.reversalDescription(reversalJournal.reversesJournalEntryId, transactionId, source)
    ) {
      throw reversalConflict(
        'REVERSAL_IDEMPOTENCY_CONFLICT',
        'Idempotency key was reused with different reversal details.',
      );
    }

    const sourceTransaction =
      reversalJournal.sourceTransaction ??
      (await this.findTransaction(this.prisma, reversalJournal.businessId, transactionId));

    return this.toReverseResponse(
      reversalJournal,
      reversalJournal.reversesJournalEntryId,
      sourceTransaction,
      reason,
      reversalDate,
      [],
      reversalJournal.postedAt ?? reversalJournal.updatedAt,
    );
  }

  private async findTransaction(
    prisma: PrismaClientLike,
    businessId: string,
    transactionId: string,
  ): Promise<Transaction> {
    const transaction = await prisma.transaction.findFirst({
      where: {
        businessId,
        deletedAt: null,
        id: transactionId,
      },
    });

    if (!transaction) {
      throw reversalNotFound('TRANSACTION_NOT_FOUND', 'Transaction not found for this business.');
    }

    return transaction;
  }

  private async resolveOriginalJournal(
    prisma: PrismaClientLike,
    businessId: string,
    transactionId: string,
  ): Promise<OriginalJournalEntryForReversal> {
    const journals = await prisma.journalEntry.findMany({
      include: {
        lines: {
          include: { account: true },
          orderBy: { createdAt: 'asc' },
        },
        reversedByJournalEntry: true,
      },
      orderBy: { createdAt: 'asc' },
      where: {
        businessId,
        deletedAt: null,
        reversesJournalEntryId: null,
        sourceTransactionId: transactionId,
      },
    });

    if (journals.length === 0) {
      throw reversalConflict(
        'REVERSAL_JOURNAL_NOT_FOUND',
        'Posted transaction has no matching original journal entry. Reconciliation is required.',
      );
    }

    if (journals.length > 1) {
      throw reversalConflict(
        'REVERSAL_RECONCILIATION_REQUIRED',
        'Posted transaction has multiple possible original journal entries. Reconciliation is required.',
      );
    }

    return journals[0]!;
  }

  private throwNonPostedTransactionError(originalJournal: OriginalJournalEntryForReversal) {
    if (
      originalJournal.status === JournalEntryStatus.REVERSED ||
      originalJournal.reversedByJournalEntry
    ) {
      throw reversalConflict(
        'REVERSAL_ALREADY_COMPLETED',
        'This posted journal already has a reversal.',
      );
    }

    throw reversalConflict(
      'REVERSAL_TRANSACTION_NOT_POSTED',
      'Only POSTED transactions can be reversed.',
    );
  }

  private async findReversalByIdempotencyKey(
    businessId: string,
    idempotencyKey: string,
    prisma: PrismaClientLike = this.prisma,
  ): Promise<ReversalJournalEntryForResponse | null> {
    return prisma.journalEntry.findFirst({
      include: this.reversalJournalInclude(),
      where: {
        businessId,
        deletedAt: null,
        idempotencyKey,
      },
    });
  }

  private reversalJournalInclude() {
    return {
      lines: {
        include: { account: true },
        orderBy: { createdAt: 'asc' as const },
      },
      reversesJournalEntry: true,
      sourceTransaction: true,
    };
  }

  private toReverseResponse(
    reversalJournal: ReversalJournalEntryForResponse,
    originalJournalEntryId: string,
    transaction: Pick<Transaction, 'id' | 'status' | 'type'>,
    reason: string,
    reversalDate: string,
    warnings: ReverseTransactionResponse['warnings'],
    reversedAt: Date,
  ): ReverseTransactionResponse {
    const totals = validateJournalLinesBalanced(reversalJournal.lines);

    return {
      businessId: reversalJournal.businessId,
      idempotencyKey: reversalJournal.idempotencyKey,
      lines: reversalJournal.lines.map((line) => ({
        accountCode: line.account.code,
        accountId: line.accountId,
        accountName: line.account.name,
        accountType: line.account.type,
        creditAmount: line.creditAmount.toFixed(2),
        debitAmount: line.debitAmount.toFixed(2),
        description: line.description ?? undefined,
      })),
      originalJournalEntryId,
      originalJournalStatus: 'REVERSED',
      reason,
      reversalDate,
      reversalJournalEntryId: reversalJournal.id,
      reversalJournalStatus: 'POSTED',
      reversedAt: reversedAt.toISOString(),
      totalCredit: totals.totalCredit,
      totalDebit: totals.totalDebit,
      transactionId: transaction.id,
      transactionStatus: 'VOIDED',
      transactionType: transaction.type as TransactionType,
      warnings,
    };
  }

  private reversalDescription(
    originalJournalEntryId: string,
    transactionId: string,
    source: ReversalSource,
  ) {
    return `Reversal (${source}) of journal ${originalJournalEntryId} for transaction ${transactionId}`;
  }

  private sameDate(value: Date, expectedIsoDate: string) {
    return (
      value.toISOString().slice(0, 10) === new Date(expectedIsoDate).toISOString().slice(0, 10)
    );
  }
}
