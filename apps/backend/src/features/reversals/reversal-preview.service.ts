import { Inject, Injectable } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { ReversalPreviewDto } from './dto/reversal-preview.dto';
import { reversalConflict, reversalNotFound } from './reversal.errors';
import { buildReversalPreview } from './reversal-preview.builder';
import type {
  OriginalJournalEntryForReversal,
  ReversalPreviewResponse,
  TransactionForReversalPreview,
} from './reversal-preview.types';
import {
  assertOriginalJournalCanBeReversed,
  requireReversalDate,
  requireReversalReason,
} from './reversal-validators';

@Injectable()
export class ReversalPreviewService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async preview(
    businessId: string,
    transactionId: string,
    dto: ReversalPreviewDto,
  ): Promise<ReversalPreviewResponse> {
    const reason = requireReversalReason(dto.reason);
    const reversalDate = requireReversalDate(dto.reversalDate);
    const transaction = await this.findTransaction(businessId, transactionId);

    if (transaction.status !== TransactionStatus.POSTED) {
      throw reversalConflict(
        'REVERSAL_TRANSACTION_NOT_POSTED',
        'Only POSTED transactions can be reversal-previewed.',
      );
    }

    const originalJournal = await this.resolveOriginalJournal(businessId, transaction.id);
    assertOriginalJournalCanBeReversed(businessId, originalJournal);

    const preview = buildReversalPreview(originalJournal);

    return {
      businessId,
      canReverse: true,
      errors: [],
      isBalanced: preview.isBalanced,
      lines: preview.lines,
      originalJournalEntryId: originalJournal.id,
      originalJournalStatus: originalJournal.status,
      reason,
      reversalDate,
      totalCredit: preview.totalCredit,
      totalDebit: preview.totalDebit,
      transactionId: transaction.id,
      transactionStatus: transaction.status,
      transactionType: transaction.type,
      warnings: preview.warnings,
    };
  }

  private async findTransaction(
    businessId: string,
    transactionId: string,
  ): Promise<TransactionForReversalPreview> {
    const transaction = await this.prisma.transaction.findFirst({
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
    businessId: string,
    transactionId: string,
  ): Promise<OriginalJournalEntryForReversal> {
    const journals = await this.prisma.journalEntry.findMany({
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
}
