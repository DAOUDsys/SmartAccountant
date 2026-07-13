import { JournalEntryStatus, Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it, vi } from 'vitest';
import { ReversalSource } from './dto/reverse-transaction.dto';
import { getReversalErrorCode, type ReversalErrorCode } from './reversal.errors';
import { ReversalService } from './reversal.service';

const now = new Date('2026-07-11T10:00:00.000Z');
const reversedAt = new Date('2026-07-11T12:00:00.000Z');
function createAuditLogServiceMock(options: { fail?: boolean } = {}) {
  return {
    createEvent: vi.fn(() => {
      if (options.fail) {
        return Promise.reject(new Error('forced audit write failure'));
      }

      return Promise.resolve({ id: 'audit_created' });
    }),
  };
}

function createReversalService(prisma: unknown, auditLogService = createAuditLogServiceMock()) {
  return new ReversalService(prisma as never, auditLogService as never);
}

const cashAccount = {
  businessId: 'business_1',
  code: '1000',
  createdAt: now,
  deletedAt: null,
  description: null,
  id: 'account_cash',
  isActive: true,
  isSystem: true,
  name: 'Cash',
  normalBalance: 'DEBIT',
  parentId: null,
  type: 'ASSET',
  updatedAt: now,
};

const revenueAccount = {
  businessId: 'business_1',
  code: '4000',
  createdAt: now,
  deletedAt: null,
  description: null,
  id: 'account_revenue',
  isActive: true,
  isSystem: true,
  name: 'Sales Revenue',
  normalBalance: 'CREDIT',
  parentId: null,
  type: 'REVENUE',
  updatedAt: now,
};

const reverseDto = {
  idempotencyKey: 'reverse-key-1',
  reason: 'Customer sale was entered twice',
  reversalDate: '2026-07-11',
  source: ReversalSource.MANUAL,
};

function transaction(
  type: TransactionType = TransactionType.SALE,
  status: TransactionStatus = TransactionStatus.POSTED,
) {
  return {
    adjustmentReason: type === TransactionType.ADJUSTMENT ? 'Correction' : null,
    businessId: 'business_1',
    createdAt: now,
    createdById: 'user_1',
    currency: 'USD',
    customerId: type === TransactionType.SALE ? 'customer_1' : null,
    deletedAt: null,
    description: 'Posted transaction',
    id: 'transaction_1',
    status,
    supplierId: type === TransactionType.PURCHASE ? 'supplier_1' : null,
    totalAmount: new Decimal(100),
    transactionDate: now,
    type,
    updatedAt: now,
    voidReason: null,
    voidedAt: null,
    voidedById: null,
  };
}

function originalJournal(overrides: Record<string, unknown> = {}) {
  return {
    businessId: 'business_1',
    createdAt: now,
    createdById: 'user_1',
    deletedAt: null,
    description: 'Posted transaction',
    id: 'journal_original',
    idempotencyKey: 'post-key-1',
    lines: [
      {
        account: cashAccount,
        accountId: cashAccount.id,
        createdAt: now,
        creditAmount: new Decimal(0),
        debitAmount: new Decimal(100),
        description: 'Posted debit line.',
        id: 'line_debit',
        journalEntryId: 'journal_original',
        updatedAt: now,
      },
      {
        account: revenueAccount,
        accountId: revenueAccount.id,
        createdAt: now,
        creditAmount: new Decimal(100),
        debitAmount: new Decimal(0),
        description: 'Posted credit line.',
        id: 'line_credit',
        journalEntryId: 'journal_original',
        updatedAt: now,
      },
    ],
    postedAt: now,
    postingDate: now,
    reversedAt: null,
    reversedById: null,
    reversedByJournalEntry: null,
    reversalReason: null,
    reversesJournalEntryId: null,
    sourceTransactionId: 'transaction_1',
    status: JournalEntryStatus.POSTED,
    updatedAt: now,
    voidedAt: null,
    voidedById: null,
    ...overrides,
  };
}

function reversalJournal(overrides: Record<string, unknown> = {}) {
  return {
    ...originalJournal({
      description: 'Reversal (MANUAL) of journal journal_original for transaction transaction_1',
      id: 'journal_reversal',
      idempotencyKey: 'reverse-key-1',
      lines: [
        {
          account: cashAccount,
          accountId: cashAccount.id,
          createdAt: reversedAt,
          creditAmount: new Decimal(100),
          debitAmount: new Decimal(0),
          description: 'Reversal of Posted debit line.',
          id: 'line_reversal_credit',
          journalEntryId: 'journal_reversal',
          updatedAt: reversedAt,
        },
        {
          account: revenueAccount,
          accountId: revenueAccount.id,
          createdAt: reversedAt,
          creditAmount: new Decimal(0),
          debitAmount: new Decimal(100),
          description: 'Reversal of Posted credit line.',
          id: 'line_reversal_debit',
          journalEntryId: 'journal_reversal',
          updatedAt: reversedAt,
        },
      ],
      postedAt: reversedAt,
      postingDate: new Date('2026-07-11T00:00:00.000Z'),
      reversalReason: 'Customer sale was entered twice',
      reversesJournalEntry: originalJournal({
        reversedAt,
        reversedById: 'user_1',
        status: JournalEntryStatus.REVERSED,
      }),
      reversesJournalEntryId: 'journal_original',
      sourceTransaction: transaction(TransactionType.SALE, TransactionStatus.VOIDED),
      status: JournalEntryStatus.POSTED,
    }),
    ...overrides,
  };
}

function createPrisma({
  existingByKey = null,
  journalCreateError,
  journals = [originalJournal()],
  originalUpdateCount = 1,
  transactionStatus = TransactionStatus.POSTED,
  transactionType = TransactionType.SALE,
  transactionUpdateCount = 1,
}: {
  existingByKey?: unknown;
  journalCreateError?: unknown;
  journals?: unknown[];
  originalUpdateCount?: number;
  transactionStatus?: TransactionStatus;
  transactionType?: TransactionType;
  transactionUpdateCount?: number;
} = {}) {
  const transactionValue = transaction(transactionType, transactionStatus);
  const makeReversalFromCreate = (args: {
    data: {
      description: string;
      idempotencyKey: string;
      lines: {
        create: Array<{
          accountId: string;
          creditAmount: string;
          debitAmount: string;
          description: string;
        }>;
      };
      postedAt: Date;
      postingDate: Date;
      reversalReason: string;
      reversesJournalEntryId: string;
      sourceTransactionId: string;
    };
  }) => ({
    ...reversalJournal({
      description: args.data.description,
      idempotencyKey: args.data.idempotencyKey,
      lines: args.data.lines.create.map((line, index) => ({
        account: line.accountId === cashAccount.id ? cashAccount : revenueAccount,
        accountId: line.accountId,
        createdAt: args.data.postedAt,
        creditAmount: new Decimal(line.creditAmount),
        debitAmount: new Decimal(line.debitAmount),
        description: line.description,
        id: `reversal_line_${index}`,
        journalEntryId: 'journal_reversal',
        updatedAt: args.data.postedAt,
      })),
      postedAt: args.data.postedAt,
      postingDate: args.data.postingDate,
      reversalReason: args.data.reversalReason,
      reversesJournalEntryId: args.data.reversesJournalEntryId,
      sourceTransaction: { ...transactionValue, status: TransactionStatus.VOIDED },
      sourceTransactionId: args.data.sourceTransactionId,
    }),
  });

  const tx = {
    accountMapping: { findMany: vi.fn() },
    journalEntry: {
      create: vi.fn((args) => {
        if (journalCreateError) {
          throw journalCreateError;
        }

        return Promise.resolve(makeReversalFromCreate(args));
      }),
      findFirst: vi.fn().mockResolvedValue(existingByKey),
      findMany: vi.fn().mockResolvedValue(journals),
      updateMany: vi.fn().mockResolvedValue({ count: originalUpdateCount }),
    },
    journalLine: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    product: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    transaction: {
      findFirst: vi.fn().mockResolvedValue(transactionValue),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: transactionUpdateCount }),
    },
    transactionAdjustmentLine: { findMany: vi.fn() },
    transactionLine: { findMany: vi.fn() },
  };

  const prisma = {
    ...tx,
    $transaction: vi.fn(async (callback) => callback(tx)),
    journalEntry: {
      ...tx.journalEntry,
      findFirst: vi.fn().mockResolvedValue(existingByKey),
    },
  };

  return { prisma, tx };
}

async function expectReversalCode(promise: Promise<unknown>, code: ReversalErrorCode) {
  try {
    await promise;
  } catch (error) {
    expect(getReversalErrorCode(error)).toBe(code);
    return;
  }

  throw new Error(`Expected reversal error code ${code}.`);
}

describe('ReversalService', () => {
  it.each([
    TransactionType.SALE,
    TransactionType.EXPENSE,
    TransactionType.PURCHASE,
    TransactionType.CUSTOMER_PAYMENT,
    TransactionType.SUPPLIER_PAYMENT,
    TransactionType.ADJUSTMENT,
  ])('atomically reverses a posted %s transaction from original journal lines', async (type) => {
    const { prisma, tx } = createPrisma({ transactionType: type });
    const auditLogService = createAuditLogServiceMock();
    const service = createReversalService(prisma as never, auditLogService);

    const result = await service.reverseTransaction('business_1', 'transaction_1', 'user_1', {
      ...reverseDto,
      idempotencyKey: `reverse-${type}`,
    });

    expect(auditLogService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'user_1',
        businessId: 'business_1',
        entityId: 'transaction_1',
        eventType: 'TRANSACTION_REVERSAL_SUCCEEDED',
        metadata: expect.objectContaining({
          idempotencyKeyFingerprint: expect.any(String),
          originalJournalEntryId: 'journal_original',
          originalJournalStatusAfter: JournalEntryStatus.REVERSED,
          originalJournalStatusBefore: JournalEntryStatus.POSTED,
          reversalJournalEntryId: 'journal_reversal',
          transactionStatusAfter: TransactionStatus.VOIDED,
          transactionStatusBefore: TransactionStatus.POSTED,
        }),
        relatedEntityId: 'journal_reversal',
        relatedEntityType: 'JOURNAL_ENTRY',
      }),
      tx,
    );
    expect(result.transactionType).toBe(type);
    expect(result.transactionStatus).toBe('VOIDED');
    expect(result.originalJournalStatus).toBe('REVERSED');
    expect(result.reversalJournalStatus).toBe('POSTED');
    expect(result.totalDebit).toBe('100.00');
    expect(result.totalCredit).toBe('100.00');
    expect(result.lines).toEqual([
      expect.objectContaining({
        accountId: cashAccount.id,
        creditAmount: '100.00',
        debitAmount: '0.00',
      }),
      expect.objectContaining({
        accountId: revenueAccount.id,
        creditAmount: '0.00',
        debitAmount: '100.00',
      }),
    ]);
    expect(tx.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reversesJournalEntryId: 'journal_original',
          sourceTransactionId: 'transaction_1',
          status: JournalEntryStatus.POSTED,
        }),
      }),
    );
    expect(tx.journalEntry.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reversedById: 'user_1',
        status: JournalEntryStatus.REVERSED,
      }),
      where: {
        businessId: 'business_1',
        id: 'journal_original',
        status: JournalEntryStatus.POSTED,
      },
    });
    expect(tx.transaction.updateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: TransactionStatus.VOIDED,
        voidReason: reverseDto.reason,
        voidedById: 'user_1',
      }),
      where: {
        businessId: 'business_1',
        id: 'transaction_1',
        status: TransactionStatus.POSTED,
      },
    });
    expect(tx.accountMapping.findMany).not.toHaveBeenCalled();
    expect(tx.transactionLine.findMany).not.toHaveBeenCalled();
    expect(tx.transactionAdjustmentLine.findMany).not.toHaveBeenCalled();
    expect(tx.journalLine.deleteMany).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it('requires reason and idempotency key', async () => {
    const service = createReversalService(createPrisma().prisma as never);

    await expectReversalCode(
      service.reverseTransaction('business_1', 'transaction_1', 'user_1', {
        ...reverseDto,
        reason: ' ',
      }),
      'REVERSAL_REASON_REQUIRED',
    );

    await expectReversalCode(
      service.reverseTransaction('business_1', 'transaction_1', 'user_1', {
        ...reverseDto,
        idempotencyKey: '',
      }),
      'REVERSAL_IDEMPOTENCY_KEY_REQUIRED',
    );
  });

  it.each([TransactionStatus.DRAFT, TransactionStatus.VOIDED])(
    'rejects %s transactions unless already reversed by the same key',
    async (status) => {
      const service = createReversalService(
        createPrisma({ transactionStatus: status }).prisma as never,
      );

      await expectReversalCode(
        service.reverseTransaction('business_1', 'transaction_1', 'user_1', reverseDto),
        'REVERSAL_TRANSACTION_NOT_POSTED',
      );
    },
  );

  it('fails safely for missing or multiple original journals', async () => {
    await expectReversalCode(
      createReversalService(createPrisma({ journals: [] }).prisma as never).reverseTransaction(
        'business_1',
        'transaction_1',
        'user_1',
        reverseDto,
      ),
      'REVERSAL_JOURNAL_NOT_FOUND',
    );

    await expectReversalCode(
      createReversalService(
        createPrisma({ journals: [originalJournal(), originalJournal({ id: 'journal_2' })] })
          .prisma as never,
      ).reverseTransaction('business_1', 'transaction_1', 'user_1', reverseDto),
      'REVERSAL_RECONCILIATION_REQUIRED',
    );
  });

  it('rejects non-POSTED, reversal, already reversed, and unbalanced original journals', async () => {
    await expectReversalCode(
      createReversalService(
        createPrisma({ journals: [originalJournal({ status: JournalEntryStatus.DRAFT })] })
          .prisma as never,
      ).reverseTransaction('business_1', 'transaction_1', 'user_1', reverseDto),
      'REVERSAL_RECONCILIATION_REQUIRED',
    );

    await expectReversalCode(
      createReversalService(
        createPrisma({ journals: [originalJournal({ reversesJournalEntryId: 'another' })] })
          .prisma as never,
      ).reverseTransaction('business_1', 'transaction_1', 'user_1', reverseDto),
      'REVERSAL_RECONCILIATION_REQUIRED',
    );

    await expectReversalCode(
      createReversalService(
        createPrisma({
          journals: [
            originalJournal({
              reversedByJournalEntry: reversalJournal(),
              status: JournalEntryStatus.REVERSED,
            }),
          ],
        }).prisma as never,
      ).reverseTransaction('business_1', 'transaction_1', 'user_1', reverseDto),
      'REVERSAL_ALREADY_COMPLETED',
    );

    await expectReversalCode(
      createReversalService(
        createPrisma({
          journals: [
            originalJournal({
              lines: [
                originalJournal().lines[0],
                { ...originalJournal().lines[1], creditAmount: new Decimal(50) },
              ],
            }),
          ],
        }).prisma as never,
      ).reverseTransaction('business_1', 'transaction_1', 'user_1', reverseDto),
      'REVERSAL_ORIGINAL_JOURNAL_UNBALANCED',
    );
  });

  it('returns the same reversal for idempotent retry and rejects mismatched reuse', async () => {
    const existing = reversalJournal();
    const retry = await createReversalService(
      createPrisma({ existingByKey: existing }).prisma as never,
    ).reverseTransaction('business_1', 'transaction_1', 'user_1', reverseDto);

    expect(retry.reversalJournalEntryId).toBe('journal_reversal');

    await expectReversalCode(
      createReversalService(
        createPrisma({ existingByKey: existing }).prisma as never,
      ).reverseTransaction('business_1', 'transaction_2', 'user_1', reverseDto),
      'REVERSAL_IDEMPOTENCY_CONFLICT',
    );

    await expectReversalCode(
      createReversalService(
        createPrisma({ existingByKey: existing }).prisma as never,
      ).reverseTransaction('business_1', 'transaction_1', 'user_1', {
        ...reverseDto,
        reason: 'Different reason',
      }),
      'REVERSAL_IDEMPOTENCY_CONFLICT',
    );
  });

  it('rejects a second key after a completed reversal', async () => {
    const service = createReversalService(
      createPrisma({
        journals: [
          originalJournal({
            reversedByJournalEntry: reversalJournal({ idempotencyKey: 'other-key' }),
            status: JournalEntryStatus.REVERSED,
          }),
        ],
        transactionStatus: TransactionStatus.VOIDED,
      }).prisma as never,
    );

    await expectReversalCode(
      service.reverseTransaction('business_1', 'transaction_1', 'user_1', {
        ...reverseDto,
        idempotencyKey: 'new-key',
      }),
      'REVERSAL_ALREADY_COMPLETED',
    );
  });

  it('returns warnings for inactive or deleted original accounts without substitution', async () => {
    const { prisma } = createPrisma({
      journals: [
        originalJournal({
          lines: [
            originalJournal().lines[0],
            {
              ...originalJournal().lines[1],
              account: {
                ...revenueAccount,
                deletedAt: now,
                isActive: false,
              },
            },
          ],
        }),
      ],
    });

    const result = await createReversalService(prisma as never).reverseTransaction(
      'business_1',
      'transaction_1',
      'user_1',
      reverseDto,
    );

    expect(result.warnings).toEqual([
      expect.objectContaining({ code: 'REVERSAL_ACCOUNT_INACTIVE_OR_DELETED' }),
    ]);
    expect(result.lines[1]!.accountId).toBe(revenueAccount.id);
  });

  it('rolls back when original journal or transaction conditional updates fail', async () => {
    await expectReversalCode(
      createReversalService(
        createPrisma({ originalUpdateCount: 0 }).prisma as never,
      ).reverseTransaction('business_1', 'transaction_1', 'user_1', reverseDto),
      'REVERSAL_CONCURRENT_CONFLICT',
    );

    await expectReversalCode(
      createReversalService(
        createPrisma({ transactionUpdateCount: 0 }).prisma as never,
      ).reverseTransaction('business_1', 'transaction_1', 'user_1', reverseDto),
      'REVERSAL_CONCURRENT_CONFLICT',
    );
  });

  it('handles unique constraint races without leaking raw Prisma errors', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      clientVersion: 'test',
      code: 'P2002',
    });

    await expectReversalCode(
      createReversalService(
        createPrisma({ journalCreateError: error }).prisma as never,
      ).reverseTransaction('business_1', 'transaction_1', 'user_1', reverseDto),
      'REVERSAL_ALREADY_COMPLETED',
    );
  });

  it('preserves atomicity when journal creation fails', async () => {
    const { prisma, tx } = createPrisma({ journalCreateError: new Error('create failed') });
    const service = createReversalService(prisma as never);

    await expect(
      service.reverseTransaction('business_1', 'transaction_1', 'user_1', reverseDto),
    ).rejects.toThrow('create failed');

    expect(tx.journalEntry.updateMany).not.toHaveBeenCalled();
    expect(tx.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('uses safe not-found behavior for cross-tenant transactions', async () => {
    const { prisma } = createPrisma();
    prisma.transaction.findFirst.mockResolvedValue(null);

    await expectReversalCode(
      createReversalService(prisma as never).reverseTransaction(
        'business_1',
        'transaction_from_other_business',
        'user_1',
        reverseDto,
      ),
      'TRANSACTION_NOT_FOUND',
    );
  });
});
