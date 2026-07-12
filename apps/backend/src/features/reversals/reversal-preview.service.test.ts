import { JournalEntryStatus, TransactionStatus, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it, vi } from 'vitest';
import { getReversalErrorCode, type ReversalErrorCode } from './reversal.errors';
import { ReversalPreviewService } from './reversal-preview.service';

const now = new Date('2026-07-11T10:00:00.000Z');

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

function transaction(
  type: TransactionType = TransactionType.SALE,
  status: TransactionStatus = TransactionStatus.POSTED,
) {
  return {
    adjustmentReason: type === TransactionType.ADJUSTMENT ? 'Correct opening balance' : null,
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

function journalEntry(overrides: Record<string, unknown> = {}) {
  return {
    businessId: 'business_1',
    createdAt: now,
    createdById: 'user_1',
    deletedAt: null,
    description: 'Posted transaction',
    id: 'journal_1',
    idempotencyKey: 'post-key-1',
    lines: [
      {
        account: cashAccount,
        accountId: cashAccount.id,
        createdAt: now,
        creditAmount: new Decimal(0),
        debitAmount: new Decimal(100),
        description: 'Posted debit line.',
        id: 'journal_line_debit',
        journalEntryId: 'journal_1',
        updatedAt: now,
      },
      {
        account: revenueAccount,
        accountId: revenueAccount.id,
        createdAt: now,
        creditAmount: new Decimal(100),
        debitAmount: new Decimal(0),
        description: 'Posted credit line.',
        id: 'journal_line_credit',
        journalEntryId: 'journal_1',
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

function createPrisma({
  journals = [journalEntry()],
  transactionValue = transaction(),
}: {
  journals?: unknown[];
  transactionValue?: unknown;
} = {}) {
  return {
    accountMapping: {
      findMany: vi.fn(),
    },
    journalEntry: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn().mockResolvedValue(journals),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    journalLine: {
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
    product: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    transaction: {
      findFirst: vi.fn().mockResolvedValue(transactionValue),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    transactionAdjustmentLine: {
      findMany: vi.fn(),
    },
    transactionLine: {
      findMany: vi.fn(),
    },
  };
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

const previewDto = {
  reason: 'Customer sale was entered twice',
  reversalDate: '2026-07-11',
};

describe('ReversalPreviewService', () => {
  it.each([
    TransactionType.SALE,
    TransactionType.EXPENSE,
    TransactionType.PURCHASE,
    TransactionType.CUSTOMER_PAYMENT,
    TransactionType.SUPPLIER_PAYMENT,
    TransactionType.ADJUSTMENT,
  ])(
    'builds a balanced non-persisted %s reversal preview from original journal lines',
    async (type) => {
      const prisma = createPrisma({ transactionValue: transaction(type) });
      const service = new ReversalPreviewService(prisma as never);

      const result = await service.preview('business_1', 'transaction_1', previewDto);

      expect(result.transactionType).toBe(type);
      expect(result.canReverse).toBe(true);
      expect(result.totalDebit).toBe('100.00');
      expect(result.totalCredit).toBe('100.00');
      expect(result.isBalanced).toBe(true);
      expect(result.lines).toEqual([
        expect.objectContaining({
          creditAmount: '100.00',
          debitAmount: '0.00',
          originalCreditAmount: '0.00',
          originalDebitAmount: '100.00',
          originalJournalLineId: 'journal_line_debit',
        }),
        expect.objectContaining({
          creditAmount: '0.00',
          debitAmount: '100.00',
          originalCreditAmount: '100.00',
          originalDebitAmount: '0.00',
          originalJournalLineId: 'journal_line_credit',
        }),
      ]);
      expect(prisma.accountMapping.findMany).not.toHaveBeenCalled();
      expect(prisma.transactionLine.findMany).not.toHaveBeenCalled();
      expect(prisma.transactionAdjustmentLine.findMany).not.toHaveBeenCalled();
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
      expect(prisma.journalLine.createMany).not.toHaveBeenCalled();
      expect(prisma.transaction.update).not.toHaveBeenCalled();
      expect(prisma.product.update).not.toHaveBeenCalled();
    },
  );

  it('requires a non-blank reason', async () => {
    const service = new ReversalPreviewService(createPrisma() as never);

    await expectReversalCode(
      service.preview('business_1', 'transaction_1', {
        reason: '   ',
        reversalDate: '2026-07-11',
      }),
      'REVERSAL_REASON_REQUIRED',
    );
  });

  it('requires a valid reversal date', async () => {
    const service = new ReversalPreviewService(createPrisma() as never);

    await expectReversalCode(
      service.preview('business_1', 'transaction_1', {
        reason: 'Duplicate',
        reversalDate: 'not-a-date',
      }),
      'REVERSAL_INVALID_DATE',
    );
  });

  it.each([TransactionStatus.DRAFT, TransactionStatus.VOIDED])(
    'rejects %s transaction reversal preview',
    async (status) => {
      const service = new ReversalPreviewService(
        createPrisma({ transactionValue: transaction(TransactionType.SALE, status) }) as never,
      );

      await expectReversalCode(
        service.preview('business_1', 'transaction_1', previewDto),
        'REVERSAL_TRANSACTION_NOT_POSTED',
      );
    },
  );

  it('fails safely when the transaction is missing or cross-tenant', async () => {
    const service = new ReversalPreviewService(createPrisma({ transactionValue: null }) as never);

    await expectReversalCode(
      service.preview('business_1', 'transaction_from_other_business', previewDto),
      'TRANSACTION_NOT_FOUND',
    );
  });

  it('requires exactly one original source-linked journal', async () => {
    const missing = new ReversalPreviewService(createPrisma({ journals: [] }) as never);
    await expectReversalCode(
      missing.preview('business_1', 'transaction_1', previewDto),
      'REVERSAL_JOURNAL_NOT_FOUND',
    );

    const duplicate = new ReversalPreviewService(
      createPrisma({ journals: [journalEntry(), journalEntry({ id: 'journal_2' })] }) as never,
    );
    await expectReversalCode(
      duplicate.preview('business_1', 'transaction_1', previewDto),
      'REVERSAL_RECONCILIATION_REQUIRED',
    );
  });

  it('rejects non-POSTED, already REVERSED, and already linked original journals', async () => {
    await expectReversalCode(
      new ReversalPreviewService(
        createPrisma({ journals: [journalEntry({ status: JournalEntryStatus.DRAFT })] }) as never,
      ).preview('business_1', 'transaction_1', previewDto),
      'REVERSAL_RECONCILIATION_REQUIRED',
    );

    await expectReversalCode(
      new ReversalPreviewService(
        createPrisma({
          journals: [journalEntry({ status: JournalEntryStatus.REVERSED })],
        }) as never,
      ).preview('business_1', 'transaction_1', previewDto),
      'REVERSAL_ALREADY_COMPLETED',
    );

    await expectReversalCode(
      new ReversalPreviewService(
        createPrisma({
          journals: [
            journalEntry({
              reversedByJournalEntry: journalEntry({
                id: 'journal_reversal',
                reversesJournalEntryId: 'journal_1',
              }),
            }),
          ],
        }) as never,
      ).preview('business_1', 'transaction_1', previewDto),
      'REVERSAL_ALREADY_COMPLETED',
    );
  });

  it('rejects unbalanced original journals', async () => {
    const unbalanced = journalEntry({
      lines: [
        journalEntry().lines[0],
        {
          ...journalEntry().lines[1],
          creditAmount: new Decimal(50),
        },
      ],
    });
    const service = new ReversalPreviewService(createPrisma({ journals: [unbalanced] }) as never);

    await expectReversalCode(
      service.preview('business_1', 'transaction_1', previewDto),
      'REVERSAL_ORIGINAL_JOURNAL_UNBALANCED',
    );
  });

  it('fails safely when a journal line account is outside the business', async () => {
    const crossTenant = journalEntry({
      lines: [
        journalEntry().lines[0],
        {
          ...journalEntry().lines[1],
          account: {
            ...revenueAccount,
            businessId: 'business_2',
          },
        },
      ],
    });
    const service = new ReversalPreviewService(createPrisma({ journals: [crossTenant] }) as never);

    await expectReversalCode(
      service.preview('business_1', 'transaction_1', previewDto),
      'REVERSAL_RECONCILIATION_REQUIRED',
    );
  });

  it('warns but preserves inactive or soft-deleted original ledger accounts', async () => {
    const inactive = journalEntry({
      lines: [
        journalEntry().lines[0],
        {
          ...journalEntry().lines[1],
          account: {
            ...revenueAccount,
            deletedAt: now,
            isActive: false,
          },
        },
      ],
    });
    const service = new ReversalPreviewService(createPrisma({ journals: [inactive] }) as never);

    const result = await service.preview('business_1', 'transaction_1', previewDto);

    expect(result.warnings).toEqual([
      expect.objectContaining({
        code: 'REVERSAL_ACCOUNT_INACTIVE_OR_DELETED',
      }),
    ]);
    expect(result.lines[1]!.accountId).toBe(revenueAccount.id);
  });
});
