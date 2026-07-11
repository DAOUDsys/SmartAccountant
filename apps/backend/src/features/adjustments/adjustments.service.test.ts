import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  AccountType,
  NormalBalance,
  TransactionStatus,
  TransactionType,
  type Account,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it, vi } from 'vitest';
import { AdjustmentsService } from './adjustments.service';

const now = new Date('2026-07-11T00:00:00.000Z');

function account(overrides: Partial<Account> = {}): Account {
  return {
    businessId: 'business_1',
    code: '1000',
    createdAt: now,
    deletedAt: null,
    description: null,
    id: 'cash_account',
    isActive: true,
    isSystem: true,
    name: 'Cash',
    normalBalance: NormalBalance.DEBIT,
    parentId: null,
    type: AccountType.ASSET,
    updatedAt: now,
    ...overrides,
  };
}

const cash = account();
const equity = account({
  code: '3000',
  id: 'equity_account',
  name: 'Owner Equity',
  normalBalance: NormalBalance.CREDIT,
  type: AccountType.EQUITY,
});
const expense = account({
  code: '5100',
  id: 'expense_account',
  isSystem: false,
  name: 'General Expense',
  type: AccountType.EXPENSE,
});

function transaction(overrides = {}) {
  return {
    adjustmentReason: 'Opening balance setup',
    businessId: 'business_1',
    createdAt: now,
    createdById: 'user_1',
    currency: 'USD',
    customerId: null,
    deletedAt: null,
    description: 'Correct opening balance',
    id: 'transaction_1',
    status: TransactionStatus.DRAFT,
    supplierId: null,
    totalAmount: new Decimal(100),
    transactionDate: now,
    type: TransactionType.ADJUSTMENT,
    updatedAt: now,
    ...overrides,
  };
}

function adjustmentLine(lineOverrides = {}, lineAccount: Account = cash) {
  return {
    account: lineAccount,
    accountId: lineAccount.id,
    businessId: 'business_1',
    createdAt: now,
    creditAmount: new Decimal(0),
    debitAmount: new Decimal(100),
    description: 'Debit Cash',
    id: 'adjustment_line_1',
    transactionId: 'transaction_1',
    updatedAt: now,
    ...lineOverrides,
  };
}

function createPrismaMock(
  options: {
    accounts?: Account[];
    existingLines?: ReturnType<typeof adjustmentLine>[];
    transactionValue?: ReturnType<typeof transaction> | null;
  } = {},
) {
  const transactionValue = 'transactionValue' in options ? options.transactionValue : transaction();
  const existingLines = options.existingLines ?? [
    adjustmentLine({}, cash),
    adjustmentLine(
      {
        creditAmount: new Decimal(100),
        debitAmount: new Decimal(0),
        description: 'Credit Owner Equity',
        id: 'adjustment_line_2',
      },
      equity,
    ),
  ];
  const createdLines: ReturnType<typeof adjustmentLine>[] = [];

  const tx = {
    transaction: {
      update: vi.fn().mockResolvedValue(transactionValue),
    },
    transactionAdjustmentLine: {
      createMany: vi.fn((args) => {
        createdLines.splice(
          0,
          createdLines.length,
          ...args.data.map(
            (
              line: {
                accountId: string;
                creditAmount: string;
                debitAmount: string;
                description?: string;
              },
              index: number,
            ) =>
              adjustmentLine(
                {
                  creditAmount: new Decimal(line.creditAmount),
                  debitAmount: new Decimal(line.debitAmount),
                  description: line.description,
                  id: `created_line_${index + 1}`,
                },
                (options.accounts ?? [cash, equity, expense]).find(
                  (candidate) => candidate.id === line.accountId,
                ) ?? cash,
              ),
          ),
        );
        return Promise.resolve({ count: args.data.length });
      }),
      deleteMany: vi.fn().mockResolvedValue({ count: existingLines.length }),
      findMany: vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(createdLines.length ? createdLines : existingLines),
        ),
    },
  };

  return {
    prisma: {
      ...tx,
      $transaction: vi.fn((callback) => callback(tx)),
      account: {
        findMany: vi.fn().mockResolvedValue(options.accounts ?? [cash, equity, expense]),
      },
      journalEntry: {
        create: vi.fn(),
      },
      journalLine: {
        create: vi.fn(),
      },
      product: {
        update: vi.fn(),
      },
      transaction: {
        findFirst: vi.fn().mockResolvedValue(transactionValue),
        update: vi.fn(),
      },
      transactionAdjustmentLine: {
        findMany: vi.fn().mockResolvedValue(existingLines),
      },
    },
    tx,
  };
}

const validDto = {
  description: 'Correct opening balance',
  lines: [
    { accountId: cash.id, debitAmount: '100.00', description: 'Debit Cash' },
    { accountId: equity.id, creditAmount: '100.00', description: 'Credit Owner Equity' },
  ],
  postingDate: '2026-07-11',
  reason: 'Opening balance setup',
};

describe('AdjustmentsService', () => {
  it('stores valid two-line adjustment lines for a DRAFT ADJUSTMENT transaction', async () => {
    const { prisma, tx } = createPrismaMock();
    const service = new AdjustmentsService(prisma as never);

    const result = await service.replaceLines('business_1', 'transaction_1', validDto);

    expect(result).toHaveLength(2);
    expect(tx.transactionAdjustmentLine.deleteMany).toHaveBeenCalledWith({
      where: { businessId: 'business_1', transactionId: 'transaction_1' },
    });
    expect(tx.transaction.update).toHaveBeenCalledWith({
      data: {
        adjustmentReason: 'Opening balance setup',
        description: 'Correct opening balance',
        transactionDate: new Date('2026-07-11'),
      },
      where: { id: 'transaction_1' },
    });
    expect(tx.transactionAdjustmentLine.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ accountId: cash.id, debitAmount: '100.00' }),
        expect.objectContaining({ accountId: equity.id, creditAmount: '100.00' }),
      ],
    });
  });

  it('stores valid multi-line adjustment lines', async () => {
    const { prisma } = createPrismaMock();
    const service = new AdjustmentsService(prisma as never);

    await expect(
      service.replaceLines('business_1', 'transaction_1', {
        ...validDto,
        lines: [
          { accountId: cash.id, debitAmount: '60.00' },
          { accountId: expense.id, debitAmount: '40.00' },
          { accountId: equity.id, creditAmount: '100.00' },
        ],
      }),
    ).resolves.toHaveLength(3);
  });

  it('lists only adjustment lines scoped to the current business and transaction', async () => {
    const { prisma } = createPrismaMock();
    const service = new AdjustmentsService(prisma as never);

    await service.listLines('business_1', 'transaction_1');

    expect(prisma.transactionAdjustmentLine.findMany).toHaveBeenCalledWith({
      include: { account: true },
      orderBy: { createdAt: 'asc' },
      where: { businessId: 'business_1', transactionId: 'transaction_1' },
    });
  });

  it('rejects missing, cross-tenant, inactive, and deleted accounts safely', async () => {
    const crossTenant = createPrismaMock({ accounts: [equity] });
    const inactive = createPrismaMock({
      accounts: [account({ id: cash.id, isActive: false }), equity],
    });
    const deleted = createPrismaMock({
      accounts: [account({ deletedAt: now, id: cash.id }), equity],
    });

    await expect(
      new AdjustmentsService(crossTenant.prisma as never).replaceLines(
        'business_1',
        'transaction_1',
        validDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      new AdjustmentsService(inactive.prisma as never).replaceLines(
        'business_1',
        'transaction_1',
        validDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      new AdjustmentsService(deleted.prisma as never).replaceLines(
        'business_1',
        'transaction_1',
        validDto,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid adjustment line amount combinations', async () => {
    const service = new AdjustmentsService(createPrismaMock().prisma as never);

    await expect(
      service.replaceLines('business_1', 'transaction_1', {
        ...validDto,
        lines: [{ accountId: cash.id, debitAmount: '100.00' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.replaceLines('business_1', 'transaction_1', {
        ...validDto,
        lines: [
          { accountId: cash.id, debitAmount: '100.00' },
          { accountId: equity.id, creditAmount: '90.00' },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.replaceLines('business_1', 'transaction_1', {
        ...validDto,
        lines: [
          { accountId: cash.id, debitAmount: '0.00' },
          { accountId: equity.id, creditAmount: '0.00' },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.replaceLines('business_1', 'transaction_1', {
        ...validDto,
        lines: [
          { accountId: cash.id, creditAmount: '100.00', debitAmount: '100.00' },
          { accountId: equity.id, creditAmount: '100.00' },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.replaceLines('business_1', 'transaction_1', {
        ...validDto,
        lines: [
          { accountId: cash.id, debitAmount: '-100.00' },
          { accountId: equity.id, creditAmount: '100.00' },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-adjustment and non-draft transactions', async () => {
    await expect(
      new AdjustmentsService(
        createPrismaMock({ transactionValue: transaction({ type: TransactionType.SALE }) })
          .prisma as never,
      ).replaceLines('business_1', 'transaction_1', validDto),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      new AdjustmentsService(
        createPrismaMock({ transactionValue: transaction({ status: TransactionStatus.POSTED }) })
          .prisma as never,
      ).replaceLines('business_1', 'transaction_1', validDto),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('denies cross-tenant transaction guesses safely', async () => {
    const service = new AdjustmentsService(
      createPrismaMock({ transactionValue: null }).prisma as never,
    );

    await expect(service.listLines('business_1', 'other_transaction')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns balanced preview lines with sensitive account warnings and no ledger persistence', async () => {
    const { prisma } = createPrismaMock();
    const service = new AdjustmentsService(prisma as never);

    const result = await service.preview('business_1', 'transaction_1');

    expect(result).toMatchObject({
      canPost: true,
      isBalanced: true,
      totalCredit: '100.00',
      totalDebit: '100.00',
      transactionStatus: TransactionStatus.DRAFT,
      transactionType: TransactionType.ADJUSTMENT,
    });
    expect(result.lines).toMatchObject([
      { accountName: 'Cash', debitAmount: '100.00' },
      { accountName: 'Owner Equity', creditAmount: '100.00' },
    ]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    expect(prisma.journalLine.create).not.toHaveBeenCalled();
    expect(prisma.transaction.update).not.toHaveBeenCalled();
    expect(prisma.product.update).not.toHaveBeenCalled();
    expect('inventoryMovement' in prisma).toBe(false);
    expect('auditLog' in prisma).toBe(false);
  });
});
