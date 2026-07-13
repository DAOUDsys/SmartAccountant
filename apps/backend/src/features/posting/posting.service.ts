import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountMappingKey,
  AuditActorType,
  AuditOutcome,
  JournalEntryStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';
import type { BusinessRole, Prisma as PrismaTypes } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  AUDIT_EVENTS,
  AuditLogService,
  fingerprintIdempotencyKey,
  mapAccountingAuditSource,
  type AccountingAuditContext,
} from '../audit';
import {
  calculateJournalTotals,
  validateJournalLinesBalanced,
} from '../journals/validators/journal-balancing';
import {
  validateAdjustmentHeader,
  validateAdjustmentLines,
} from '../adjustments/adjustment-line.validators';
import { buildAdjustmentPreview } from '../adjustments/adjustment-preview.builder';
import type { AdjustmentPreviewIssue } from '../adjustments/adjustment-preview.types';
import {
  hasBusinessPermission,
  type BusinessPermission,
} from '../businesses/permissions/business-permissions';
import type { PostTransactionDto } from './dto/post-transaction.dto';
import { buildPostingJournalLines } from './posting-journal.builder';
import {
  inactiveMappedAccountIssue,
  issue,
  missingMappingIssue,
  wrongMappedAccountTypeIssue,
} from './posting-preview.errors';
import {
  expectedAccountTypesByMappingKey,
  validateTransactionIntentAmounts,
} from './posting-preview.validators';
import type {
  AccountMappingLookup,
  AccountMappingWithAccount,
  PostingPreviewIssue,
  TransactionIntentForPreview,
} from './posting-preview.types';
import type { PostedJournalEntryWithLines, PostTransactionResponse } from './posting.types';

const supportedPostingTypes: TransactionType[] = [
  TransactionType.SALE,
  TransactionType.EXPENSE,
  TransactionType.PURCHASE,
  TransactionType.CUSTOMER_PAYMENT,
  TransactionType.SUPPLIER_PAYMENT,
  TransactionType.ADJUSTMENT,
];

const supportedPostingTypesMessage =
  'Posting is only supported for SALE, EXPENSE, PURCHASE, CUSTOMER_PAYMENT, SUPPLIER_PAYMENT, and ADJUSTMENT transactions.';

@Injectable()
export class PostingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
  ) {}

  async postTransaction(
    businessId: string,
    transactionId: string,
    userId: string,
    membershipRole: BusinessRole,
    dto: PostTransactionDto,
    auditContext: AccountingAuditContext = { actorUserId: userId, transportSource: 'API' },
  ): Promise<PostTransactionResponse> {
    const idempotencyKey = dto.idempotencyKey?.trim();

    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency key is required.');
    }

    const existingByKey = await this.findJournalByIdempotencyKey(businessId, idempotencyKey);
    if (existingByKey) {
      await this.ensureIdempotentJournalMatchesTransaction(existingByKey, transactionId);
      const transaction = await this.findTransactionForPosting(
        this.prisma,
        businessId,
        transactionId,
      );
      this.assertPostingPermission(transaction.type, membershipRole);
      return this.toPostResponse(
        existingByKey,
        await this.warningsForTransaction(businessId, transactionId),
        transaction.type,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingInsideTransaction = await this.findJournalByIdempotencyKey(
          businessId,
          idempotencyKey,
          tx,
        );

        if (existingInsideTransaction) {
          await this.ensureIdempotentJournalMatchesTransaction(
            existingInsideTransaction,
            transactionId,
          );
          const transaction = await this.findTransactionForPosting(tx, businessId, transactionId);
          this.assertPostingPermission(transaction.type, membershipRole);
          return this.toPostResponse(
            existingInsideTransaction,
            await this.warningsForTransaction(businessId, transactionId, tx),
            transaction.type,
          );
        }

        const transaction = await this.findTransactionForPosting(tx, businessId, transactionId);
        this.assertPostingPermission(transaction.type, membershipRole);
        await this.assertTransactionCanPost(tx, businessId, transaction);

        if (transaction.type === TransactionType.ADJUSTMENT) {
          return this.postAdjustmentTransaction(
            tx,
            businessId,
            userId,
            idempotencyKey,
            transaction,
            dto,
            auditContext,
          );
        }

        await this.validateRelatedRecordsBelongToBusiness(tx, businessId, transaction);

        const mappings = await this.loadAccountMappings(tx, businessId);
        this.assertRequiredAccountMappings(
          businessId,
          mappings,
          this.requiredMappingKeysForTransaction(transaction),
        );

        const builtJournal = buildPostingJournalLines(transaction, mappings);
        const postingDate = this.resolvePostingDate(dto.postingDate, transaction.transactionDate);
        const postedAt = new Date();

        const journalEntry = await tx.journalEntry.create({
          data: {
            businessId,
            createdById: userId,
            description: `Posted ${transaction.type} transaction ${transaction.id}`,
            idempotencyKey,
            lines: {
              create: builtJournal.lines.map((line) => ({
                accountId: line.account.id,
                creditAmount: line.creditAmount,
                debitAmount: line.debitAmount,
                description: line.description,
              })),
            },
            postedAt,
            postingDate,
            sourceTransactionId: transaction.id,
            status: JournalEntryStatus.POSTED,
          },
          include: this.journalEntryInclude(),
        });

        await tx.transaction.update({
          data: { status: TransactionStatus.POSTED },
          where: { id: transaction.id },
        });

        await this.auditPostSucceeded(
          tx,
          businessId,
          transaction,
          journalEntry,
          idempotencyKey,
          dto.source,
          auditContext,
        );

        return this.toPostResponse(journalEntry, builtJournal.warnings, transaction.type);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existingAfterConflict = await this.findJournalByIdempotencyKey(
          businessId,
          idempotencyKey,
        );

        if (existingAfterConflict) {
          await this.ensureIdempotentJournalMatchesTransaction(
            existingAfterConflict,
            transactionId,
          );
          const transaction = await this.findTransactionForPosting(
            this.prisma,
            businessId,
            transactionId,
          );
          this.assertPostingPermission(transaction.type, membershipRole);
          return this.toPostResponse(
            existingAfterConflict,
            await this.warningsForTransaction(businessId, transactionId),
            transaction.type,
          );
        }
      }

      throw error;
    }
  }

  private journalEntryInclude() {
    return {
      lines: {
        include: { account: true },
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }

  private async findJournalByIdempotencyKey(
    businessId: string,
    idempotencyKey: string,
    prisma: PrismaTypes.TransactionClient | PrismaService = this.prisma,
  ): Promise<PostedJournalEntryWithLines | null> {
    return prisma.journalEntry.findFirst({
      include: this.journalEntryInclude(),
      where: {
        businessId,
        deletedAt: null,
        idempotencyKey,
        status: JournalEntryStatus.POSTED,
      },
    });
  }

  private async findTransactionForPosting(
    prisma: PrismaTypes.TransactionClient | PrismaService,
    businessId: string,
    transactionId: string,
  ): Promise<TransactionIntentForPreview> {
    const transaction = await prisma.transaction.findFirst({
      include: { lines: true },
      where: {
        businessId,
        deletedAt: null,
        id: transactionId,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found.');
    }

    return transaction;
  }

  private async assertTransactionCanPost(
    prisma: PrismaTypes.TransactionClient,
    businessId: string,
    transaction: TransactionIntentForPreview,
  ) {
    const existingJournalForTransaction = await prisma.journalEntry.findFirst({
      include: this.journalEntryInclude(),
      where: {
        businessId,
        deletedAt: null,
        sourceTransactionId: transaction.id,
        status: JournalEntryStatus.POSTED,
      },
    });

    if (existingJournalForTransaction) {
      throw new ConflictException('This transaction already has a posted journal entry.');
    }

    if (transaction.status === TransactionStatus.POSTED) {
      throw new ConflictException(
        'This transaction has an intent status of POSTED, but no matching posted journal entry was found. Posting reconciliation is required.',
      );
    }

    if (transaction.status !== TransactionStatus.DRAFT) {
      throw new ConflictException('Only DRAFT transaction intents can be posted.');
    }

    if (!supportedPostingTypes.includes(transaction.type)) {
      throw new BadRequestException(supportedPostingTypesMessage);
    }

    if (transaction.type !== TransactionType.ADJUSTMENT) {
      const amountErrors = validateTransactionIntentAmounts(transaction);
      this.throwValidationErrors([
        ...amountErrors,
        ...this.validateRequiredPaymentParty(transaction),
      ]);
    }
  }

  private assertPostingPermission(transactionType: TransactionType, role: BusinessRole) {
    const permission: BusinessPermission =
      transactionType === TransactionType.ADJUSTMENT ? 'adjustments.post' : 'journalEntries.post';

    if (!hasBusinessPermission(role, permission)) {
      throw new ForbiddenException('You do not have permission to post this transaction.');
    }
  }

  private async postAdjustmentTransaction(
    prisma: PrismaTypes.TransactionClient,
    businessId: string,
    userId: string,
    idempotencyKey: string,
    transaction: TransactionIntentForPreview,
    dto: PostTransactionDto,
    auditContext: AccountingAuditContext = { actorUserId: userId, transportSource: 'API' },
  ): Promise<PostTransactionResponse> {
    const headerErrors = validateAdjustmentHeader({
      description: transaction.description,
      reason: transaction.adjustmentReason,
    });
    this.throwAdjustmentValidationErrors(headerErrors, 'Adjustment header is invalid.');

    if (!transaction.currency.trim()) {
      throw new BadRequestException('Transaction currency is required.');
    }

    const adjustmentLines = await prisma.transactionAdjustmentLine.findMany({
      include: { account: true },
      orderBy: { createdAt: 'asc' },
      where: {
        businessId,
        transactionId: transaction.id,
      },
    });

    validateAdjustmentLines(
      businessId,
      adjustmentLines.map((line) => ({
        accountId: line.accountId,
        creditAmount: line.creditAmount.toFixed(2),
        debitAmount: line.debitAmount.toFixed(2),
        description: line.description ?? undefined,
      })),
      adjustmentLines.map((line) => line.account),
    );

    const builtAdjustment = buildAdjustmentPreview(adjustmentLines);
    validateJournalLinesBalanced(builtAdjustment.lines);

    const postingDate = this.resolvePostingDate(dto.postingDate, transaction.transactionDate);
    const postedAt = new Date();
    const journalEntry = await prisma.journalEntry.create({
      data: {
        businessId,
        createdById: userId,
        description:
          transaction.description?.trim() ?? `Posted ADJUSTMENT transaction ${transaction.id}`,
        idempotencyKey,
        lines: {
          create: builtAdjustment.lines.map((line) => ({
            accountId: line.accountId,
            creditAmount: line.creditAmount,
            debitAmount: line.debitAmount,
            description: line.description,
          })),
        },
        postedAt,
        postingDate,
        sourceTransactionId: transaction.id,
        status: JournalEntryStatus.POSTED,
      },
      include: this.journalEntryInclude(),
    });

    await prisma.transaction.update({
      data: { status: TransactionStatus.POSTED },
      where: { id: transaction.id },
    });

    await this.auditPostSucceeded(
      prisma,
      businessId,
      transaction,
      journalEntry,
      idempotencyKey,
      dto.source,
      auditContext,
    );

    return this.toPostResponse(
      journalEntry,
      builtAdjustment.warnings.map((warning) => warning.message),
      transaction.type,
    );
  }

  private async auditPostSucceeded(
    prisma: PrismaTypes.TransactionClient,
    businessId: string,
    transaction: TransactionIntentForPreview,
    journalEntry: PostedJournalEntryWithLines,
    idempotencyKey: string,
    operationSource: PostTransactionDto['source'],
    auditContext: AccountingAuditContext,
  ) {
    const totals = calculateJournalTotals(journalEntry.lines);

    await this.auditLogService.createEvent(
      {
        actorType: AuditActorType.USER,
        actorUserId: auditContext.actorUserId,
        businessId,
        correlationId: auditContext.correlationId,
        entityId: transaction.id,
        entityType: 'TRANSACTION',
        eventType: AUDIT_EVENTS.TRANSACTION_POST_SUCCEEDED,
        ipAddress: auditContext.ipAddress,
        metadata: {
          currency: transaction.currency,
          idempotencyKeyFingerprint: fingerprintIdempotencyKey(idempotencyKey),
          journalEntryId: journalEntry.id,
          lineCount: journalEntry.lines.length,
          operationSource: operationSource ?? 'MANUAL',
          postingDate: journalEntry.postingDate.toISOString(),
          totalCredit: totals.totalCredit,
          totalDebit: totals.totalDebit,
          transactionStatusAfter: TransactionStatus.POSTED,
          transactionStatusBefore: transaction.status,
          transactionType: transaction.type,
        },
        outcome: AuditOutcome.SUCCESS,
        relatedEntityId: journalEntry.id,
        relatedEntityType: 'JOURNAL_ENTRY',
        requestId: auditContext.requestId,
        source: mapAccountingAuditSource(operationSource, auditContext),
        userAgent: auditContext.userAgent,
      },
      prisma,
    );
  }
  private async validateRelatedRecordsBelongToBusiness(
    prisma: PrismaTypes.TransactionClient,
    businessId: string,
    transaction: TransactionIntentForPreview,
  ) {
    const errors: PostingPreviewIssue[] = [];

    if (transaction.customerId) {
      const customer = await prisma.customer.findFirst({
        select: { id: true },
        where: {
          businessId,
          deletedAt: null,
          id: transaction.customerId,
        },
      });

      if (!customer) {
        errors.push(
          issue(
            'CROSS_TENANT_REFERENCE',
            'Customer reference is not available for this business.',
            'customerId',
          ),
        );
      }
    }

    if (transaction.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        select: { id: true },
        where: {
          businessId,
          deletedAt: null,
          id: transaction.supplierId,
        },
      });

      if (!supplier) {
        errors.push(
          issue(
            'CROSS_TENANT_REFERENCE',
            'Supplier reference is not available for this business.',
            'supplierId',
          ),
        );
      }
    }

    const productIds = [
      ...new Set(transaction.lines.map((line) => line.productId).filter(Boolean)),
    ] as string[];

    if (productIds.length > 0) {
      const products = await prisma.product.findMany({
        select: { id: true },
        where: {
          businessId,
          deletedAt: null,
          id: { in: productIds },
        },
      });

      if (products.length !== productIds.length) {
        errors.push(
          issue(
            'CROSS_TENANT_REFERENCE',
            'Product reference is not available for this business.',
            'lines.productId',
          ),
        );
      }
    }

    this.throwValidationErrors(errors);
  }

  private async loadAccountMappings(
    prisma: PrismaTypes.TransactionClient,
    businessId: string,
  ): Promise<AccountMappingLookup> {
    const mappings = await prisma.accountMapping.findMany({
      include: { account: true },
      where: {
        businessId,
        key: {
          in: Object.values(AccountMappingKey),
        },
      },
    });

    return mappings.reduce<AccountMappingLookup>((lookup, mapping) => {
      lookup[mapping.key] = mapping as AccountMappingWithAccount;
      return lookup;
    }, {});
  }

  private assertRequiredAccountMappings(
    businessId: string,
    mappings: AccountMappingLookup,
    requiredKeys: AccountMappingKey[],
  ) {
    const errors = requiredKeys.flatMap((key) => {
      const mapping = mappings[key];
      const expectedType = expectedAccountTypesByMappingKey[key];

      if (!mapping) {
        return [missingMappingIssue(key)];
      }

      if (
        mapping.businessId !== businessId ||
        mapping.account.businessId !== businessId ||
        !mapping.account.isActive ||
        mapping.account.deletedAt
      ) {
        return [inactiveMappedAccountIssue(key)];
      }

      if (mapping.account.type !== expectedType) {
        return [wrongMappedAccountTypeIssue(key, expectedType, mapping.account.type)];
      }

      return [];
    });

    this.throwValidationErrors(errors);
  }

  private requiredMappingKeysForTransaction(
    transaction: TransactionIntentForPreview,
  ): AccountMappingKey[] {
    const hasProductLines = transaction.lines.some((line) => Boolean(line.productId));

    switch (transaction.type) {
      case TransactionType.SALE:
        return [
          transaction.customerId ? AccountMappingKey.ACCOUNTS_RECEIVABLE : AccountMappingKey.CASH,
          AccountMappingKey.SALES_REVENUE,
        ];
      case TransactionType.EXPENSE:
        return [AccountMappingKey.GENERAL_EXPENSE, AccountMappingKey.CASH];
      case TransactionType.PURCHASE:
        return [
          hasProductLines ? AccountMappingKey.INVENTORY_ASSET : AccountMappingKey.GENERAL_EXPENSE,
          transaction.supplierId ? AccountMappingKey.ACCOUNTS_PAYABLE : AccountMappingKey.CASH,
        ];
      case TransactionType.CUSTOMER_PAYMENT:
        return [AccountMappingKey.CASH, AccountMappingKey.ACCOUNTS_RECEIVABLE];
      case TransactionType.SUPPLIER_PAYMENT:
        return [AccountMappingKey.ACCOUNTS_PAYABLE, AccountMappingKey.CASH];
      default:
        return [];
    }
  }

  private validateRequiredPaymentParty(
    transaction: TransactionIntentForPreview,
  ): PostingPreviewIssue[] {
    if (transaction.type === TransactionType.CUSTOMER_PAYMENT && !transaction.customerId) {
      return [
        issue(
          'MISSING_CUSTOMER',
          'Customer payment posting requires a customer reference.',
          'customerId',
        ),
      ];
    }

    if (transaction.type === TransactionType.SUPPLIER_PAYMENT && !transaction.supplierId) {
      return [
        issue(
          'MISSING_SUPPLIER',
          'Supplier payment posting requires a supplier reference.',
          'supplierId',
        ),
      ];
    }

    return [];
  }

  private async ensureIdempotentJournalMatchesTransaction(
    journalEntry: PostedJournalEntryWithLines,
    transactionId: string,
  ) {
    if (journalEntry.sourceTransactionId !== transactionId) {
      throw new ConflictException(
        'Idempotency key is already used for a different transaction in this business.',
      );
    }
  }

  private async warningsForTransaction(
    businessId: string,
    transactionId: string,
    prisma: PrismaTypes.TransactionClient | PrismaService = this.prisma,
  ): Promise<string[]> {
    const transaction = await prisma.transaction.findFirst({
      include: { lines: true },
      where: {
        businessId,
        deletedAt: null,
        id: transactionId,
      },
    });

    if (!transaction) {
      return [];
    }

    if (transaction.type === TransactionType.ADJUSTMENT) {
      const lines = await prisma.transactionAdjustmentLine.findMany({
        include: { account: true },
        orderBy: { createdAt: 'asc' },
        where: {
          businessId,
          transactionId,
        },
      });

      return buildAdjustmentPreview(lines).warnings.map((warning) => warning.message);
    }

    const hasProductLines = transaction.lines.some((line) => Boolean(line.productId));

    if (transaction.type === TransactionType.SALE && hasProductLines) {
      return ['Inventory and COGS posting is not implemented yet.'];
    }

    if (transaction.type === TransactionType.PURCHASE && hasProductLines) {
      return ['Inventory quantity movement is not implemented yet.'];
    }

    return [];
  }

  private resolvePostingDate(postingDate: string | undefined, fallbackDate: Date): Date {
    const resolved = postingDate ? new Date(postingDate) : fallbackDate;

    if (Number.isNaN(resolved.getTime())) {
      throw new BadRequestException('Posting date is invalid.');
    }

    return resolved;
  }

  private throwValidationErrors(errors: PostingPreviewIssue[]) {
    if (errors.length > 0) {
      throw new BadRequestException({
        errors,
        message: 'Transaction cannot be posted.',
      });
    }
  }

  private throwAdjustmentValidationErrors(errors: AdjustmentPreviewIssue[], message: string) {
    if (errors.length > 0) {
      throw new BadRequestException({
        errors,
        message,
      });
    }
  }

  private toPostResponse(
    journalEntry: PostedJournalEntryWithLines,
    warnings: string[],
    transactionType: TransactionType,
  ): PostTransactionResponse {
    const totals = calculateJournalTotals(journalEntry.lines);

    return {
      businessId: journalEntry.businessId,
      idempotencyKey: journalEntry.idempotencyKey,
      journalEntryId: journalEntry.id,
      lines: journalEntry.lines.map((line) => ({
        accountCode: line.account.code,
        accountId: line.accountId,
        accountName: line.account.name,
        creditAmount: line.creditAmount.toFixed(2),
        debitAmount: line.debitAmount.toFixed(2),
        description: line.description ?? undefined,
      })),
      postedAt: journalEntry.postedAt?.toISOString() ?? journalEntry.updatedAt.toISOString(),
      status: 'POSTED',
      totalCredit: totals.totalCredit,
      totalDebit: totals.totalDebit,
      transactionId: journalEntry.sourceTransactionId ?? '',
      transactionType,
      warnings,
    };
  }
}
