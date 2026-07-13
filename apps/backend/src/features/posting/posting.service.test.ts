import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountMappingKey,
  AccountType,
  BusinessRole,
  JournalEntryStatus,
  NormalBalance,
  TransactionStatus,
  TransactionType,
  type Account,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it, vi } from 'vitest';
import { PostingSource } from './dto/post-transaction.dto';
import { PostingService } from './posting.service';
import type { PostedJournalEntryWithLines } from './posting.types';

const now = new Date('2026-07-11T00:00:00.000Z');
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

function createPostingService(prisma: unknown, auditLogService = createAuditLogServiceMock()) {
  return new PostingService(prisma as never, auditLogService as never);
}

const accountSpecs: Record<
  AccountMappingKey,
  Pick<Account, 'code' | 'name' | 'normalBalance' | 'type'>
> = {
  [AccountMappingKey.ACCOUNTS_PAYABLE]: {
    code: '2000',
    name: 'Accounts Payable',
    normalBalance: NormalBalance.CREDIT,
    type: AccountType.LIABILITY,
  },
  [AccountMappingKey.ACCOUNTS_RECEIVABLE]: {
    code: '1100',
    name: 'Accounts Receivable',
    normalBalance: NormalBalance.DEBIT,
    type: AccountType.ASSET,
  },
  [AccountMappingKey.CASH]: {
    code: '1000',
    name: 'Cash',
    normalBalance: NormalBalance.DEBIT,
    type: AccountType.ASSET,
  },
  [AccountMappingKey.COST_OF_GOODS_SOLD]: {
    code: '5000',
    name: 'Cost of Goods Sold',
    normalBalance: NormalBalance.DEBIT,
    type: AccountType.EXPENSE,
  },
  [AccountMappingKey.GENERAL_EXPENSE]: {
    code: '5100',
    name: 'General Expense',
    normalBalance: NormalBalance.DEBIT,
    type: AccountType.EXPENSE,
  },
  [AccountMappingKey.INVENTORY_ASSET]: {
    code: '1200',
    name: 'Inventory Asset',
    normalBalance: NormalBalance.DEBIT,
    type: AccountType.ASSET,
  },
  [AccountMappingKey.OWNER_EQUITY]: {
    code: '3000',
    name: 'Owner Equity',
    normalBalance: NormalBalance.CREDIT,
    type: AccountType.EQUITY,
  },
  [AccountMappingKey.SALES_REVENUE]: {
    code: '4000',
    name: 'Sales Revenue',
    normalBalance: NormalBalance.CREDIT,
    type: AccountType.REVENUE,
  },
};

function account(key: AccountMappingKey, overrides: Partial<Account> = {}): Account {
  const spec = accountSpecs[key];

  return {
    businessId: 'business_1',
    code: spec.code,
    createdAt: now,
    deletedAt: null,
    description: null,
    id: `${key.toLowerCase()}_account`,
    isActive: true,
    isSystem: true,
    name: spec.name,
    normalBalance: spec.normalBalance,
    parentId: null,
    type: spec.type,
    updatedAt: now,
    ...overrides,
  };
}

function accountMappings(overrides: Partial<Record<AccountMappingKey, Partial<Account>>> = {}) {
  return Object.values(AccountMappingKey).map((key) => ({
    account: account(key, overrides[key] ?? {}),
    accountId: `${key.toLowerCase()}_account`,
    businessId: 'business_1',
    createdAt: now,
    id: `${key.toLowerCase()}_mapping`,
    key,
    updatedAt: now,
  }));
}

function transaction(overrides = {}) {
  return {
    businessId: 'business_1',
    createdAt: now,
    createdById: 'user_1',
    currency: 'USD',
    customerId: null,
    deletedAt: null,
    description: null,
    id: 'transaction_1',
    lines: [
      {
        businessId: 'business_1',
        createdAt: now,
        description: 'Posting line',
        id: 'line_1',
        productId: null,
        quantity: new Decimal(1),
        totalAmount: new Decimal(200),
        transactionId: 'transaction_1',
        unitPrice: new Decimal(200),
        updatedAt: now,
      },
    ],
    status: TransactionStatus.DRAFT,
    supplierId: null,
    totalAmount: new Decimal(200),
    transactionDate: now,
    type: TransactionType.SALE,
    updatedAt: now,
    ...overrides,
  };
}

function journalEntry(
  overrides: Partial<PostedJournalEntryWithLines> = {},
): PostedJournalEntryWithLines {
  const cash = account(AccountMappingKey.CASH);
  const revenue = account(AccountMappingKey.SALES_REVENUE);

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
        account: cash,
        accountId: cash.id,
        createdAt: now,
        creditAmount: new Decimal(0),
        debitAmount: new Decimal(200),
        description: 'Posted sale intent to Cash.',
        id: 'journal_line_1',
        journalEntryId: 'journal_1',
        updatedAt: now,
      },
      {
        account: revenue,
        accountId: revenue.id,
        createdAt: now,
        creditAmount: new Decimal(200),
        debitAmount: new Decimal(0),
        description: 'Posted sale intent to Sales Revenue.',
        id: 'journal_line_2',
        journalEntryId: 'journal_1',
        updatedAt: now,
      },
    ],
    postedAt: now,
    postingDate: now,
    reversedAt: null,
    reversedById: null,
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

function adjustmentLine(
  input: {
    accountValue: Account;
    creditAmount?: string;
    debitAmount?: string;
    description?: string;
    id: string;
  },
  overrides = {},
) {
  return {
    account: input.accountValue,
    accountId: input.accountValue.id,
    businessId: 'business_1',
    createdAt: now,
    creditAmount: new Decimal(input.creditAmount ?? '0'),
    debitAmount: new Decimal(input.debitAmount ?? '0'),
    description: input.description ?? null,
    id: input.id,
    transactionId: 'transaction_1',
    updatedAt: now,
    ...overrides,
  };
}

function balancedAdjustmentLines() {
  return [
    adjustmentLine({
      accountValue: account(AccountMappingKey.CASH),
      debitAmount: '100.00',
      description: 'Debit Cash',
      id: 'adjustment_line_1',
    }),
    adjustmentLine({
      accountValue: account(AccountMappingKey.OWNER_EQUITY),
      creditAmount: '100.00',
      description: 'Credit Owner Equity',
      id: 'adjustment_line_2',
    }),
  ];
}

function createPrismaMock(
  options: {
    existingByKey?: PostedJournalEntryWithLines | null;
    existingForTransaction?: PostedJournalEntryWithLines | null;
    failJournalCreate?: boolean;
    failTransactionUpdate?: boolean;
    adjustmentLines?: ReturnType<typeof balancedAdjustmentLines>;
    mappings?: ReturnType<typeof accountMappings>;
    productCount?: number;
    customerFound?: boolean;
    supplierFound?: boolean;
    transactionValue?: ReturnType<typeof transaction> | null;
  } = {},
) {
  const transactionValue = 'transactionValue' in options ? options.transactionValue : transaction();
  const mappings = options.mappings ?? accountMappings();
  const accountById = new Map(mappings.map((mapping) => [mapping.account.id, mapping.account]));

  const tx = {
    accountMapping: {
      findMany: vi.fn().mockResolvedValue(mappings),
    },
    customer: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.customerFound === false ? null : { id: 'customer_1' }),
    },
    journalEntry: {
      create: vi.fn((args) => {
        if (options.failJournalCreate) {
          return Promise.reject(new Error('forced journal create failure'));
        }

        return Promise.resolve(
          journalEntry({
            id: 'journal_created',
            idempotencyKey: args.data.idempotencyKey,
            lines: args.data.lines.create.map(
              (
                line: {
                  accountId: string;
                  creditAmount: string;
                  debitAmount: string;
                  description: string;
                },
                index: number,
              ) => {
                const mappedAccount = accountById.get(line.accountId);

                if (!mappedAccount) {
                  throw new Error(`Missing test account ${line.accountId}`);
                }

                return {
                  account: mappedAccount,
                  accountId: line.accountId,
                  createdAt: now,
                  creditAmount: new Decimal(line.creditAmount),
                  debitAmount: new Decimal(line.debitAmount),
                  description: line.description,
                  id: `journal_line_${index + 1}`,
                  journalEntryId: 'journal_created',
                  updatedAt: now,
                };
              },
            ),
            postedAt: args.data.postedAt,
            postingDate: args.data.postingDate,
            sourceTransactionId: args.data.sourceTransactionId,
          }),
        );
      }),
      findFirst: vi.fn((args) => {
        if ('idempotencyKey' in args.where) {
          return Promise.resolve(options.existingByKey ?? null);
        }

        if ('sourceTransactionId' in args.where) {
          return Promise.resolve(options.existingForTransaction ?? null);
        }

        return Promise.resolve(null);
      }),
    },
    product: {
      findMany: vi.fn().mockResolvedValue(
        Array.from({ length: options.productCount ?? 1 }, (_, index) => ({
          id: `product_${index + 1}`,
        })),
      ),
      update: vi.fn(),
    },
    supplier: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.supplierFound === false ? null : { id: 'supplier_1' }),
    },
    transaction: {
      findFirst: vi.fn().mockResolvedValue(transactionValue),
      update: vi.fn(() => {
        if (options.failTransactionUpdate) {
          return Promise.reject(new Error('forced transaction update failure'));
        }

        return Promise.resolve({ ...(transactionValue ?? {}), status: TransactionStatus.POSTED });
      }),
    },
    transactionAdjustmentLine: {
      findMany: vi.fn().mockResolvedValue(options.adjustmentLines ?? []),
    },
  };
  const prisma = {
    ...tx,
    $transaction: vi.fn((callback) => callback(tx)),
  };

  return { prisma, tx };
}

function serviceCall(service: PostingService, dto = {}, role: BusinessRole = BusinessRole.OWNER) {
  return service.postTransaction('business_1', 'transaction_1', 'user_1', role, {
    idempotencyKey: 'post-key-1',
    source: PostingSource.MANUAL,
    ...dto,
  });
}

describe('PostingService', () => {
  it('posts a cash SALE with a POSTED JournalEntry and balanced Cash/Sales Revenue lines', async () => {
    const { prisma, tx } = createPrismaMock();
    const auditLogService = createAuditLogServiceMock();
    const service = createPostingService(prisma as never, auditLogService);

    const result = await serviceCall(service);

    expect(result).toMatchObject({
      journalEntryId: 'journal_created',
      status: 'POSTED',
      totalCredit: '200.00',
      totalDebit: '200.00',
      transactionId: 'transaction_1',
    });
    expect(result.lines).toMatchObject([
      { accountName: 'Cash', debitAmount: '200.00', creditAmount: '0.00' },
      { accountName: 'Sales Revenue', debitAmount: '0.00', creditAmount: '200.00' },
    ]);
    expect(tx.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: JournalEntryStatus.POSTED,
          sourceTransactionId: 'transaction_1',
        }),
      }),
    );
  });

  it('posts SALE with a customer by debiting Accounts Receivable and crediting Sales Revenue', async () => {
    const { prisma } = createPrismaMock({
      transactionValue: transaction({ customerId: 'customer_1' }),
    });
    const service = createPostingService(prisma as never);

    const result = await serviceCall(service);

    expect(result.lines).toMatchObject([
      { accountName: 'Accounts Receivable', debitAmount: '200.00' },
      { accountName: 'Sales Revenue', creditAmount: '200.00' },
    ]);
  });

  it('posts EXPENSE by debiting General Expense and crediting Cash', async () => {
    const { prisma } = createPrismaMock({
      transactionValue: transaction({ type: TransactionType.EXPENSE }),
    });
    const service = createPostingService(prisma as never);

    const result = await serviceCall(service);

    expect(result.lines).toMatchObject([
      { accountName: 'General Expense', debitAmount: '200.00' },
      { accountName: 'Cash', creditAmount: '200.00' },
    ]);
  });

  it('posts PURCHASE variants for inventory/payable and expense/cash', async () => {
    const productLine = { ...transaction().lines[0]!, productId: 'product_1' };
    const inventoryPurchase = createPostingService(
      createPrismaMock({
        transactionValue: transaction({
          lines: [productLine],
          supplierId: 'supplier_1',
          type: TransactionType.PURCHASE,
        }),
      }).prisma as never,
    );
    const cashPurchase = createPostingService(
      createPrismaMock({
        transactionValue: transaction({ type: TransactionType.PURCHASE }),
      }).prisma as never,
    );

    await expect(serviceCall(inventoryPurchase)).resolves.toMatchObject({
      lines: [
        expect.objectContaining({ accountName: 'Inventory Asset', debitAmount: '200.00' }),
        expect.objectContaining({ accountName: 'Accounts Payable', creditAmount: '200.00' }),
      ],
      warnings: ['Inventory quantity movement is not implemented yet.'],
    });
    await expect(serviceCall(cashPurchase)).resolves.toMatchObject({
      lines: [
        expect.objectContaining({ accountName: 'General Expense', debitAmount: '200.00' }),
        expect.objectContaining({ accountName: 'Cash', creditAmount: '200.00' }),
      ],
    });
  });

  it('posts CUSTOMER_PAYMENT by debiting Cash and crediting Accounts Receivable', async () => {
    const { prisma, tx } = createPrismaMock({
      transactionValue: transaction({
        customerId: 'customer_1',
        type: TransactionType.CUSTOMER_PAYMENT,
      }),
    });
    const service = createPostingService(prisma as never);

    const result = await serviceCall(service);

    expect(result).toMatchObject({
      journalEntryId: 'journal_created',
      status: 'POSTED',
      totalCredit: '200.00',
      totalDebit: '200.00',
      transactionId: 'transaction_1',
    });
    expect(result.lines).toMatchObject([
      { accountName: 'Cash', debitAmount: '200.00', creditAmount: '0.00' },
      { accountName: 'Accounts Receivable', debitAmount: '0.00', creditAmount: '200.00' },
    ]);
    expect(tx.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: JournalEntryStatus.POSTED,
          sourceTransactionId: 'transaction_1',
        }),
      }),
    );
  });

  it('requires customerId and same-business customer for CUSTOMER_PAYMENT posting', async () => {
    const missingCustomer = createPrismaMock({
      transactionValue: transaction({ type: TransactionType.CUSTOMER_PAYMENT }),
    });
    const crossTenantCustomer = createPrismaMock({
      customerFound: false,
      transactionValue: transaction({
        customerId: 'other_customer',
        type: TransactionType.CUSTOMER_PAYMENT,
      }),
    });

    await expect(
      serviceCall(createPostingService(missingCustomer.prisma as never)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(missingCustomer.tx.journalEntry.create).not.toHaveBeenCalled();
    await expect(
      serviceCall(createPostingService(crossTenantCustomer.prisma as never)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(crossTenantCustomer.tx.journalEntry.create).not.toHaveBeenCalled();
  });

  it('requires valid Cash and Accounts Receivable mappings for CUSTOMER_PAYMENT posting', async () => {
    const payment = transaction({
      customerId: 'customer_1',
      type: TransactionType.CUSTOMER_PAYMENT,
    });
    const missingCash = createPrismaMock({
      mappings: accountMappings().filter((mapping) => mapping.key !== AccountMappingKey.CASH),
      transactionValue: payment,
    });
    const missingReceivable = createPrismaMock({
      mappings: accountMappings().filter(
        (mapping) => mapping.key !== AccountMappingKey.ACCOUNTS_RECEIVABLE,
      ),
      transactionValue: payment,
    });
    const wrongReceivableType = createPrismaMock({
      mappings: accountMappings({
        [AccountMappingKey.ACCOUNTS_RECEIVABLE]: { type: AccountType.LIABILITY },
      }),
      transactionValue: payment,
    });

    await expect(
      serviceCall(createPostingService(missingCash.prisma as never)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      serviceCall(createPostingService(missingReceivable.prisma as never)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      serviceCall(createPostingService(wrongReceivableType.prisma as never)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('posts SUPPLIER_PAYMENT by debiting Accounts Payable and crediting Cash', async () => {
    const { prisma } = createPrismaMock({
      transactionValue: transaction({
        supplierId: 'supplier_1',
        type: TransactionType.SUPPLIER_PAYMENT,
      }),
    });
    const service = createPostingService(prisma as never);

    const result = await serviceCall(service);

    expect(result).toMatchObject({
      status: 'POSTED',
      totalCredit: '200.00',
      totalDebit: '200.00',
    });
    expect(result.lines).toMatchObject([
      { accountName: 'Accounts Payable', debitAmount: '200.00', creditAmount: '0.00' },
      { accountName: 'Cash', debitAmount: '0.00', creditAmount: '200.00' },
    ]);
  });

  it('requires supplierId and same-business supplier for SUPPLIER_PAYMENT posting', async () => {
    const missingSupplier = createPrismaMock({
      transactionValue: transaction({ type: TransactionType.SUPPLIER_PAYMENT }),
    });
    const crossTenantSupplier = createPrismaMock({
      supplierFound: false,
      transactionValue: transaction({
        supplierId: 'other_supplier',
        type: TransactionType.SUPPLIER_PAYMENT,
      }),
    });

    await expect(
      serviceCall(createPostingService(missingSupplier.prisma as never)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(missingSupplier.tx.journalEntry.create).not.toHaveBeenCalled();
    await expect(
      serviceCall(createPostingService(crossTenantSupplier.prisma as never)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(crossTenantSupplier.tx.journalEntry.create).not.toHaveBeenCalled();
  });

  it('requires valid Accounts Payable and Cash mappings for SUPPLIER_PAYMENT posting', async () => {
    const payment = transaction({
      supplierId: 'supplier_1',
      type: TransactionType.SUPPLIER_PAYMENT,
    });
    const missingPayable = createPrismaMock({
      mappings: accountMappings().filter(
        (mapping) => mapping.key !== AccountMappingKey.ACCOUNTS_PAYABLE,
      ),
      transactionValue: payment,
    });
    const missingCash = createPrismaMock({
      mappings: accountMappings().filter((mapping) => mapping.key !== AccountMappingKey.CASH),
      transactionValue: payment,
    });
    const wrongPayableType = createPrismaMock({
      mappings: accountMappings({
        [AccountMappingKey.ACCOUNTS_PAYABLE]: { type: AccountType.ASSET },
      }),
      transactionValue: payment,
    });

    await expect(
      serviceCall(createPostingService(missingPayable.prisma as never)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      serviceCall(createPostingService(missingCash.prisma as never)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      serviceCall(createPostingService(wrongPayableType.prisma as never)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('posts a valid two-line ADJUSTMENT from stored adjustment lines', async () => {
    const { prisma, tx } = createPrismaMock({
      adjustmentLines: balancedAdjustmentLines(),
      transactionValue: transaction({
        adjustmentReason: 'Owner contribution',
        description: 'Opening balance adjustment',
        lines: [],
        type: TransactionType.ADJUSTMENT,
      }),
    });
    const service = createPostingService(prisma as never);

    const result = await serviceCall(service);

    expect(result).toMatchObject({
      status: 'POSTED',
      totalCredit: '100.00',
      totalDebit: '100.00',
      transactionId: 'transaction_1',
      transactionType: TransactionType.ADJUSTMENT,
    });
    expect(result.lines).toMatchObject([
      {
        accountName: 'Cash',
        creditAmount: '0.00',
        debitAmount: '100.00',
        description: 'Debit Cash',
      },
      {
        accountName: 'Owner Equity',
        creditAmount: '100.00',
        debitAmount: '0.00',
        description: 'Credit Owner Equity',
      },
    ]);
    expect(result.warnings).toContain(
      'This adjustment uses a system account. Review carefully before posting.',
    );
    expect(tx.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: 'Opening balance adjustment',
          status: JournalEntryStatus.POSTED,
          sourceTransactionId: 'transaction_1',
        }),
      }),
    );
    expect(tx.transaction.update).toHaveBeenCalledWith({
      data: { status: TransactionStatus.POSTED },
      where: { id: 'transaction_1' },
    });
  });

  it('posts a valid multi-line ADJUSTMENT and keeps debits equal to credits', async () => {
    const lines = [
      adjustmentLine({
        accountValue: account(AccountMappingKey.CASH),
        debitAmount: '120.00',
        id: 'adjustment_line_1',
      }),
      adjustmentLine({
        accountValue: account(AccountMappingKey.ACCOUNTS_RECEIVABLE),
        debitAmount: '80.00',
        id: 'adjustment_line_2',
      }),
      adjustmentLine({
        accountValue: account(AccountMappingKey.OWNER_EQUITY),
        creditAmount: '200.00',
        id: 'adjustment_line_3',
      }),
    ];
    const { prisma } = createPrismaMock({
      adjustmentLines: lines,
      transactionValue: transaction({
        adjustmentReason: 'Opening balances',
        description: 'Opening balances adjustment',
        lines: [],
        type: TransactionType.ADJUSTMENT,
      }),
    });
    const service = createPostingService(prisma as never);

    const result = await serviceCall(service);

    expect(result.lines).toHaveLength(3);
    expect(result.totalDebit).toBe('200.00');
    expect(result.totalCredit).toBe('200.00');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'This adjustment uses Accounts Receivable. Review carefully before posting.',
        'This adjustment uses Owner Equity. Review carefully before posting.',
      ]),
    );
  });

  it.each([
    {
      name: 'missing reason',
      transactionValue: transaction({
        adjustmentReason: ' ',
        description: 'Adjustment',
        lines: [],
        type: TransactionType.ADJUSTMENT,
      }),
      lines: balancedAdjustmentLines(),
    },
    {
      name: 'fewer than two lines',
      transactionValue: transaction({
        adjustmentReason: 'Reason',
        description: 'Adjustment',
        lines: [],
        type: TransactionType.ADJUSTMENT,
      }),
      lines: [balancedAdjustmentLines()[0]!],
    },
    {
      name: 'unbalanced lines',
      transactionValue: transaction({
        adjustmentReason: 'Reason',
        description: 'Adjustment',
        lines: [],
        type: TransactionType.ADJUSTMENT,
      }),
      lines: [
        adjustmentLine({
          accountValue: account(AccountMappingKey.CASH),
          debitAmount: '100.00',
          id: 'adjustment_line_1',
        }),
        adjustmentLine({
          accountValue: account(AccountMappingKey.OWNER_EQUITY),
          creditAmount: '90.00',
          id: 'adjustment_line_2',
        }),
      ],
    },
    {
      name: 'zero-value line',
      transactionValue: transaction({
        adjustmentReason: 'Reason',
        description: 'Adjustment',
        lines: [],
        type: TransactionType.ADJUSTMENT,
      }),
      lines: [
        adjustmentLine({
          accountValue: account(AccountMappingKey.CASH),
          debitAmount: '0.00',
          id: 'adjustment_line_1',
        }),
        adjustmentLine({
          accountValue: account(AccountMappingKey.OWNER_EQUITY),
          creditAmount: '100.00',
          id: 'adjustment_line_2',
        }),
      ],
    },
    {
      name: 'both-sided line',
      transactionValue: transaction({
        adjustmentReason: 'Reason',
        description: 'Adjustment',
        lines: [],
        type: TransactionType.ADJUSTMENT,
      }),
      lines: [
        adjustmentLine({
          accountValue: account(AccountMappingKey.CASH),
          creditAmount: '20.00',
          debitAmount: '100.00',
          id: 'adjustment_line_1',
        }),
        adjustmentLine({
          accountValue: account(AccountMappingKey.OWNER_EQUITY),
          creditAmount: '100.00',
          id: 'adjustment_line_2',
        }),
      ],
    },
    {
      name: 'negative amount',
      transactionValue: transaction({
        adjustmentReason: 'Reason',
        description: 'Adjustment',
        lines: [],
        type: TransactionType.ADJUSTMENT,
      }),
      lines: [
        adjustmentLine({
          accountValue: account(AccountMappingKey.CASH),
          debitAmount: '-100.00',
          id: 'adjustment_line_1',
        }),
        adjustmentLine({
          accountValue: account(AccountMappingKey.OWNER_EQUITY),
          creditAmount: '100.00',
          id: 'adjustment_line_2',
        }),
      ],
    },
    {
      name: 'cross-tenant account',
      transactionValue: transaction({
        adjustmentReason: 'Reason',
        description: 'Adjustment',
        lines: [],
        type: TransactionType.ADJUSTMENT,
      }),
      lines: [
        adjustmentLine({
          accountValue: account(AccountMappingKey.CASH, { businessId: 'other_business' }),
          debitAmount: '100.00',
          id: 'adjustment_line_1',
        }),
        adjustmentLine({
          accountValue: account(AccountMappingKey.OWNER_EQUITY),
          creditAmount: '100.00',
          id: 'adjustment_line_2',
        }),
      ],
    },
    {
      name: 'inactive account',
      transactionValue: transaction({
        adjustmentReason: 'Reason',
        description: 'Adjustment',
        lines: [],
        type: TransactionType.ADJUSTMENT,
      }),
      lines: [
        adjustmentLine({
          accountValue: account(AccountMappingKey.CASH, { isActive: false }),
          debitAmount: '100.00',
          id: 'adjustment_line_1',
        }),
        adjustmentLine({
          accountValue: account(AccountMappingKey.OWNER_EQUITY),
          creditAmount: '100.00',
          id: 'adjustment_line_2',
        }),
      ],
    },
    {
      name: 'deleted account',
      transactionValue: transaction({
        adjustmentReason: 'Reason',
        description: 'Adjustment',
        lines: [],
        type: TransactionType.ADJUSTMENT,
      }),
      lines: [
        adjustmentLine({
          accountValue: account(AccountMappingKey.CASH, { deletedAt: now }),
          debitAmount: '100.00',
          id: 'adjustment_line_1',
        }),
        adjustmentLine({
          accountValue: account(AccountMappingKey.OWNER_EQUITY),
          creditAmount: '100.00',
          id: 'adjustment_line_2',
        }),
      ],
    },
  ])('rejects invalid ADJUSTMENT posting: $name', async ({ transactionValue, lines }) => {
    const { prisma, tx } = createPrismaMock({
      adjustmentLines: lines,
      transactionValue,
    });
    const service = createPostingService(prisma as never);

    await expect(serviceCall(service)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.journalEntry.create).not.toHaveBeenCalled();
    expect(tx.transaction.update).not.toHaveBeenCalled();
  });

  it('rejects non-DRAFT ADJUSTMENT posting and historical POSTED adjustments without a journal', async () => {
    const voided = createPrismaMock({
      adjustmentLines: balancedAdjustmentLines(),
      transactionValue: transaction({
        adjustmentReason: 'Reason',
        description: 'Adjustment',
        lines: [],
        status: TransactionStatus.VOIDED,
        type: TransactionType.ADJUSTMENT,
      }),
    });
    const historicalPosted = createPrismaMock({
      adjustmentLines: balancedAdjustmentLines(),
      transactionValue: transaction({
        adjustmentReason: 'Reason',
        description: 'Adjustment',
        lines: [],
        status: TransactionStatus.POSTED,
        type: TransactionType.ADJUSTMENT,
      }),
    });

    await expect(serviceCall(createPostingService(voided.prisma as never))).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(
      serviceCall(createPostingService(historicalPosted.prisma as never)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(voided.tx.journalEntry.create).not.toHaveBeenCalled();
    expect(historicalPosted.tx.journalEntry.create).not.toHaveBeenCalled();
  });

  it('enforces adjustments.post permission by role', async () => {
    const allowedRoles = [BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.ACCOUNTANT];
    const deniedRoles = [BusinessRole.STAFF, BusinessRole.VIEWER];

    for (const role of allowedRoles) {
      const { prisma } = createPrismaMock({
        adjustmentLines: balancedAdjustmentLines(),
        transactionValue: transaction({
          adjustmentReason: 'Reason',
          description: 'Adjustment',
          lines: [],
          type: TransactionType.ADJUSTMENT,
        }),
      });

      await expect(
        serviceCall(createPostingService(prisma as never), {}, role),
      ).resolves.toMatchObject({
        transactionType: TransactionType.ADJUSTMENT,
      });
    }

    for (const role of deniedRoles) {
      const { prisma, tx } = createPrismaMock({
        adjustmentLines: balancedAdjustmentLines(),
        transactionValue: transaction({
          adjustmentReason: 'Reason',
          description: 'Adjustment',
          lines: [],
          type: TransactionType.ADJUSTMENT,
        }),
      });

      await expect(
        serviceCall(createPostingService(prisma as never), {}, role),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(tx.journalEntry.create).not.toHaveBeenCalled();
    }
  });

  it('keeps ADJUSTMENT posting idempotent and rejects duplicate posting keys', async () => {
    const existing = journalEntry({
      lines: [
        {
          account: account(AccountMappingKey.CASH),
          accountId: account(AccountMappingKey.CASH).id,
          createdAt: now,
          creditAmount: new Decimal(0),
          debitAmount: new Decimal(100),
          description: 'Debit Cash',
          id: 'adjustment_journal_line_1',
          journalEntryId: 'journal_1',
          updatedAt: now,
        },
        {
          account: account(AccountMappingKey.OWNER_EQUITY),
          accountId: account(AccountMappingKey.OWNER_EQUITY).id,
          createdAt: now,
          creditAmount: new Decimal(100),
          debitAmount: new Decimal(0),
          description: 'Credit Owner Equity',
          id: 'adjustment_journal_line_2',
          journalEntryId: 'journal_1',
          updatedAt: now,
        },
      ],
    });
    const retry = createPrismaMock({
      adjustmentLines: balancedAdjustmentLines(),
      existingByKey: existing,
      transactionValue: transaction({
        adjustmentReason: 'Reason',
        description: 'Adjustment',
        lines: [],
        status: TransactionStatus.POSTED,
        type: TransactionType.ADJUSTMENT,
      }),
    });
    const sameKeyDifferentTransaction = createPrismaMock({
      adjustmentLines: balancedAdjustmentLines(),
      existingByKey: journalEntry({ sourceTransactionId: 'transaction_2' }),
      transactionValue: transaction({
        adjustmentReason: 'Reason',
        description: 'Adjustment',
        lines: [],
        type: TransactionType.ADJUSTMENT,
      }),
    });
    const differentKeyAfterPosting = createPrismaMock({
      adjustmentLines: balancedAdjustmentLines(),
      existingForTransaction: existing,
      transactionValue: transaction({
        adjustmentReason: 'Reason',
        description: 'Adjustment',
        lines: [],
        status: TransactionStatus.POSTED,
        type: TransactionType.ADJUSTMENT,
      }),
    });

    await expect(serviceCall(createPostingService(retry.prisma as never))).resolves.toMatchObject({
      journalEntryId: existing.id,
      transactionType: TransactionType.ADJUSTMENT,
    });
    expect(retry.tx.journalEntry.create).not.toHaveBeenCalled();
    await expect(
      serviceCall(createPostingService(sameKeyDifferentTransaction.prisma as never)),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      serviceCall(createPostingService(differentKeyAfterPosting.prisma as never), {
        idempotencyKey: 'different-key',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not update an ADJUSTMENT transaction when journal creation fails', async () => {
    const { prisma, tx } = createPrismaMock({
      adjustmentLines: balancedAdjustmentLines(),
      failJournalCreate: true,
      transactionValue: transaction({
        adjustmentReason: 'Reason',
        description: 'Adjustment',
        lines: [],
        type: TransactionType.ADJUSTMENT,
      }),
    });
    const service = createPostingService(prisma as never);

    await expect(serviceCall(service)).rejects.toThrow('forced journal create failure');

    expect(tx.transaction.update).not.toHaveBeenCalled();
  });

  it('keeps payment posting idempotent and prevents duplicate payment journals', async () => {
    const existing = journalEntry({
      lines: [
        {
          account: account(AccountMappingKey.CASH),
          accountId: account(AccountMappingKey.CASH).id,
          createdAt: now,
          creditAmount: new Decimal(0),
          debitAmount: new Decimal(200),
          description: 'Posted customer payment intent to Cash.',
          id: 'payment_line_1',
          journalEntryId: 'journal_1',
          updatedAt: now,
        },
        {
          account: account(AccountMappingKey.ACCOUNTS_RECEIVABLE),
          accountId: account(AccountMappingKey.ACCOUNTS_RECEIVABLE).id,
          createdAt: now,
          creditAmount: new Decimal(200),
          debitAmount: new Decimal(0),
          description: 'Posted customer payment intent to Accounts Receivable.',
          id: 'payment_line_2',
          journalEntryId: 'journal_1',
          updatedAt: now,
        },
      ],
    });
    const retry = createPrismaMock({ existingByKey: existing });
    const duplicate = createPrismaMock({
      existingForTransaction: existing,
      transactionValue: transaction({
        customerId: 'customer_1',
        status: TransactionStatus.POSTED,
        type: TransactionType.CUSTOMER_PAYMENT,
      }),
    });

    await expect(serviceCall(createPostingService(retry.prisma as never))).resolves.toMatchObject({
      journalEntryId: existing.id,
      totalCredit: '200.00',
      totalDebit: '200.00',
    });
    expect(retry.tx.journalEntry.create).not.toHaveBeenCalled();
    await expect(
      serviceCall(createPostingService(duplicate.prisma as never), { idempotencyKey: 'new-key' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(duplicate.tx.journalEntry.create).not.toHaveBeenCalled();
  });

  it('updates Transaction.status to POSTED only after journal creation', async () => {
    const { prisma, tx } = createPrismaMock();
    const service = createPostingService(prisma as never);

    await serviceCall(service);

    expect(tx.journalEntry.create).toHaveBeenCalled();
    expect(tx.transaction.update).toHaveBeenCalledWith({
      data: { status: TransactionStatus.POSTED },
      where: { id: 'transaction_1' },
    });
    expect(tx.journalEntry.create.mock.invocationCallOrder[0]!).toBeLessThan(
      tx.transaction.update.mock.invocationCallOrder[0]!,
    );
  });

  it('does not update Transaction.status when journal creation fails', async () => {
    const { prisma, tx } = createPrismaMock({ failJournalCreate: true });
    const service = createPostingService(prisma as never);

    await expect(serviceCall(service)).rejects.toThrow('forced journal create failure');

    expect(tx.transaction.update).not.toHaveBeenCalled();
  });

  it('retries the same idempotency key by returning the existing journal result', async () => {
    const existing = journalEntry();
    const { prisma, tx } = createPrismaMock({ existingByKey: existing });
    const service = createPostingService(prisma as never);

    const result = await serviceCall(service);

    expect(result.journalEntryId).toBe(existing.id);
    expect(tx.journalEntry.create).not.toHaveBeenCalled();
    expect(tx.transaction.update).not.toHaveBeenCalled();
  });

  it('rejects the same idempotency key for a different transaction', async () => {
    const existing = journalEntry({ sourceTransactionId: 'transaction_2' });
    const { prisma } = createPrismaMock({ existingByKey: existing });
    const service = createPostingService(prisma as never);

    await expect(serviceCall(service)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an already posted transaction with a different idempotency key', async () => {
    const { prisma, tx } = createPrismaMock({
      existingForTransaction: journalEntry({ idempotencyKey: 'other-key' }),
      transactionValue: transaction({ status: TransactionStatus.POSTED }),
    });
    const service = createPostingService(prisma as never);

    await expect(serviceCall(service, { idempotencyKey: 'new-key' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.journalEntry.create).not.toHaveBeenCalled();
  });

  it('requires an idempotency key', async () => {
    const { prisma } = createPrismaMock();
    const service = createPostingService(prisma as never);

    await expect(
      service.postTransaction('business_1', 'transaction_1', 'user_1', BusinessRole.OWNER, {
        idempotencyKey: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails missing, wrong-type, inactive, and deleted account mappings safely', async () => {
    const missingMapping = createPrismaMock({
      mappings: accountMappings().filter((mapping) => mapping.key !== AccountMappingKey.CASH),
    });
    const wrongType = createPrismaMock({
      mappings: accountMappings({ [AccountMappingKey.CASH]: { type: AccountType.EXPENSE } }),
    });
    const inactive = createPrismaMock({
      mappings: accountMappings({ [AccountMappingKey.CASH]: { isActive: false } }),
    });
    const deleted = createPrismaMock({
      mappings: accountMappings({ [AccountMappingKey.CASH]: { deletedAt: now } }),
    });

    await expect(
      serviceCall(createPostingService(missingMapping.prisma as never)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      serviceCall(createPostingService(wrongType.prisma as never)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      serviceCall(createPostingService(inactive.prisma as never)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(serviceCall(createPostingService(deleted.prisma as never))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('denies cross-tenant transaction guesses and related customer/supplier/product references', async () => {
    await expect(
      serviceCall(
        createPostingService(createPrismaMock({ transactionValue: null }).prisma as never),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      serviceCall(
        createPostingService(
          createPrismaMock({
            customerFound: false,
            transactionValue: transaction({ customerId: 'other_customer' }),
          }).prisma as never,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      serviceCall(
        createPostingService(
          createPrismaMock({
            supplierFound: false,
            transactionValue: transaction({
              supplierId: 'other_supplier',
              type: TransactionType.PURCHASE,
            }),
          }).prisma as never,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      serviceCall(
        createPostingService(
          createPrismaMock({
            productCount: 0,
            transactionValue: transaction({
              lines: [{ ...transaction().lines[0]!, productId: 'other_product' }],
            }),
          }).prisma as never,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects ADJUSTMENT posting when stored adjustment lines are missing', async () => {
    const { prisma, tx } = createPrismaMock({
      transactionValue: transaction({ type: TransactionType.ADJUSTMENT }),
    });
    const service = createPostingService(prisma as never);

    await expect(serviceCall(service)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.journalEntry.create).not.toHaveBeenCalled();
    expect(tx.transaction.update).not.toHaveBeenCalled();
  });

  it('does not update product quantity and has no inventory movement or audit log behavior', async () => {
    const { prisma, tx } = createPrismaMock({
      transactionValue: transaction({
        lines: [{ ...transaction().lines[0]!, productId: 'product_1' }],
      }),
    });
    const service = createPostingService(prisma as never);

    await serviceCall(service);

    expect(tx.product.update).not.toHaveBeenCalled();
    expect('inventoryMovement' in tx).toBe(false);
    expect('auditLog' in tx).toBe(false);
  });

  it('does not treat existing transaction-intent POSTED without a journal as ledger truth', async () => {
    const { prisma, tx } = createPrismaMock({
      transactionValue: transaction({ status: TransactionStatus.POSTED }),
    });
    const service = createPostingService(prisma as never);

    await expect(serviceCall(service)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.journalEntry.create).not.toHaveBeenCalled();
  });
});
