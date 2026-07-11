import { NotFoundException } from '@nestjs/common';
import {
  AccountMappingKey,
  AccountType,
  NormalBalance,
  TransactionStatus,
  TransactionType,
  type Account,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it, vi } from 'vitest';
import { PostingPreviewService } from './posting-preview.service';
import type { TransactionIntentForPreview } from './posting-preview.types';

const now = new Date('2026-07-11T00:00:00.000Z');

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
  return Object.values(AccountMappingKey)
    .filter((key) => overrides[key] !== null)
    .map((key) => ({
      account: account(key, overrides[key] ?? {}),
      accountId: `${key.toLowerCase()}_account`,
      businessId: 'business_1',
      createdAt: now,
      id: `${key.toLowerCase()}_mapping`,
      key,
      updatedAt: now,
    }));
}

function transaction(
  overrides: Partial<TransactionIntentForPreview> = {},
): TransactionIntentForPreview {
  const base: TransactionIntentForPreview = {
    adjustmentReason: null,
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
        description: 'Preview line',
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
  };

  return { ...base, ...overrides };
}

function createPrismaMock(
  options: {
    mappings?: ReturnType<typeof accountMappings>;
    productCount?: number;
    supplierFound?: boolean;
    customerFound?: boolean;
    transactionValue?: ReturnType<typeof transaction> | null;
  } = {},
) {
  const transactionValue = 'transactionValue' in options ? options.transactionValue : transaction();

  return {
    accountMapping: {
      findMany: vi.fn().mockResolvedValue(options.mappings ?? accountMappings()),
    },
    customer: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.customerFound === false ? null : { id: 'customer_1' }),
    },
    journalEntry: {
      count: vi.fn(),
      create: vi.fn(),
    },
    journalLine: {
      count: vi.fn(),
      create: vi.fn(),
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
      update: vi.fn(),
    },
  };
}

describe('PostingPreviewService', () => {
  it('loads transactions by businessId and denies cross-tenant transaction guesses', async () => {
    const prisma = createPrismaMock({ transactionValue: null });
    const service = new PostingPreviewService(prisma as never);

    await expect(
      service.getPreview('business_1', 'other_business_transaction'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
      include: { lines: true },
      where: {
        businessId: 'business_1',
        deletedAt: null,
        id: 'other_business_transaction',
      },
    });
  });

  it('returns a balanced sale preview and does not persist ledger or transaction changes', async () => {
    const prisma = createPrismaMock();
    const service = new PostingPreviewService(prisma as never);

    const result = await service.getPreview('business_1', 'transaction_1');

    expect(result).toMatchObject({
      canPost: true,
      isBalanced: true,
      totalCredit: '200.00',
      totalDebit: '200.00',
    });
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    expect(prisma.journalLine.create).not.toHaveBeenCalled();
    expect(prisma.transaction.update).not.toHaveBeenCalled();
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('blocks POSTED transaction-intent preview with boundary-safe wording', async () => {
    const prisma = createPrismaMock({
      transactionValue: transaction({ status: TransactionStatus.POSTED }),
    });
    const service = new PostingPreviewService(prisma as never);

    const result = await service.getPreview('business_1', 'transaction_1');

    expect(result.canPost).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'TRANSACTION_STATUS_NOT_PREVIEWABLE',
        message:
          'This transaction has an intent status of POSTED, but ledger posting is not available yet. Preview is blocked until posting reconciliation is designed.',
      }),
    );
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });

  it('blocks VOIDED transaction preview', async () => {
    const prisma = createPrismaMock({
      transactionValue: transaction({ status: TransactionStatus.VOIDED }),
    });
    const service = new PostingPreviewService(prisma as never);

    const result = await service.getPreview('business_1', 'transaction_1');

    expect(result.canPost).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'TRANSACTION_STATUS_NOT_PREVIEWABLE' }),
    );
  });

  it('fails safely on line total mismatch', async () => {
    const prisma = createPrismaMock({
      transactionValue: transaction({ totalAmount: new Decimal(250) }),
    });
    const service = new PostingPreviewService(prisma as never);

    const result = await service.getPreview('business_1', 'transaction_1');

    expect(result.canPost).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: 'LINE_TOTAL_MISMATCH' }));
  });

  it('fails safely for cross-tenant customer, supplier, and product references', async () => {
    const crossTenantCustomer = createPrismaMock({
      customerFound: false,
      transactionValue: transaction({ customerId: 'other_customer' }),
    });
    const crossTenantSupplier = createPrismaMock({
      supplierFound: false,
      transactionValue: transaction({
        supplierId: 'other_supplier',
        type: TransactionType.PURCHASE,
      }),
    });
    const crossTenantProduct = createPrismaMock({
      productCount: 0,
      transactionValue: transaction({
        lines: [{ ...transaction().lines[0]!, productId: 'other_product' }],
      }),
    });

    await expect(
      new PostingPreviewService(crossTenantCustomer as never).getPreview(
        'business_1',
        'transaction_1',
      ),
    ).resolves.toMatchObject({
      canPost: false,
      errors: [expect.objectContaining({ code: 'CROSS_TENANT_REFERENCE' })],
    });
    await expect(
      new PostingPreviewService(crossTenantSupplier as never).getPreview(
        'business_1',
        'transaction_1',
      ),
    ).resolves.toMatchObject({
      canPost: false,
      errors: [expect.objectContaining({ code: 'CROSS_TENANT_REFERENCE' })],
    });
    await expect(
      new PostingPreviewService(crossTenantProduct as never).getPreview(
        'business_1',
        'transaction_1',
      ),
    ).resolves.toMatchObject({
      canPost: false,
      errors: [expect.objectContaining({ code: 'CROSS_TENANT_REFERENCE' })],
    });
  });

  it('fails safely when a required mapping is missing, inactive, deleted, or wrong type', async () => {
    const missingMapping = createPrismaMock({
      mappings: accountMappings().filter((mapping) => mapping.key !== AccountMappingKey.CASH),
    });
    const inactiveMapping = createPrismaMock({
      mappings: accountMappings({ [AccountMappingKey.CASH]: { isActive: false } }),
    });
    const deletedMapping = createPrismaMock({
      mappings: accountMappings({ [AccountMappingKey.CASH]: { deletedAt: now } }),
    });
    const wrongTypeMapping = createPrismaMock({
      mappings: accountMappings({ [AccountMappingKey.CASH]: { type: AccountType.EXPENSE } }),
    });

    await expect(
      new PostingPreviewService(missingMapping as never).getPreview('business_1', 'transaction_1'),
    ).resolves.toMatchObject({
      canPost: false,
      errors: [expect.objectContaining({ code: 'MISSING_ACCOUNT_MAPPING' })],
    });
    await expect(
      new PostingPreviewService(inactiveMapping as never).getPreview('business_1', 'transaction_1'),
    ).resolves.toMatchObject({
      canPost: false,
      errors: [expect.objectContaining({ code: 'INACTIVE_OR_DELETED_MAPPED_ACCOUNT' })],
    });
    await expect(
      new PostingPreviewService(deletedMapping as never).getPreview('business_1', 'transaction_1'),
    ).resolves.toMatchObject({
      canPost: false,
      errors: [expect.objectContaining({ code: 'INACTIVE_OR_DELETED_MAPPED_ACCOUNT' })],
    });
    await expect(
      new PostingPreviewService(wrongTypeMapping as never).getPreview(
        'business_1',
        'transaction_1',
      ),
    ).resolves.toMatchObject({
      canPost: false,
      errors: [expect.objectContaining({ code: 'WRONG_MAPPED_ACCOUNT_TYPE' })],
    });
  });

  it('returns safe adjustment rejection without creating journal rows', async () => {
    const prisma = createPrismaMock({
      transactionValue: transaction({ type: TransactionType.ADJUSTMENT }),
    });
    const service = new PostingPreviewService(prisma as never);

    const result = await service.getPreview('business_1', 'transaction_1');

    expect(result.canPost).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'ADJUSTMENT_REQUIRES_EXPLICIT_ACCOUNTS' }),
    );
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    expect(prisma.journalLine.create).not.toHaveBeenCalled();
    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });
});
