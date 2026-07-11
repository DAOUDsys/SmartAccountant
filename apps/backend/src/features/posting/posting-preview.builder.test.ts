import {
  AccountMappingKey,
  AccountType,
  NormalBalance,
  TransactionStatus,
  TransactionType,
  type Account,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it } from 'vitest';
import { buildPostingPreviewLines, validateGeneratedPreviewLines } from './posting-preview.builder';
import type { AccountMappingLookup, TransactionIntentForPreview } from './posting-preview.types';

const now = new Date('2026-07-11T00:00:00.000Z');

const accountDefinitions: Record<
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

function accountFor(key: AccountMappingKey, overrides: Partial<Account> = {}): Account {
  const definition = accountDefinitions[key];

  return {
    businessId: 'business_1',
    code: definition.code,
    createdAt: now,
    deletedAt: null,
    description: null,
    id: `${key.toLowerCase()}_account`,
    isActive: true,
    isSystem: true,
    name: definition.name,
    normalBalance: definition.normalBalance,
    parentId: null,
    type: definition.type,
    updatedAt: now,
    ...overrides,
  };
}

function mappings(overrides: Partial<AccountMappingLookup> = {}): AccountMappingLookup {
  const base = Object.values(AccountMappingKey).reduce<AccountMappingLookup>((lookup, key) => {
    lookup[key] = {
      account: accountFor(key),
      accountId: `${key.toLowerCase()}_account`,
      businessId: 'business_1',
      createdAt: now,
      id: `${key.toLowerCase()}_mapping`,
      key,
      updatedAt: now,
    };
    return lookup;
  }, {});

  return { ...base, ...overrides };
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

describe('posting preview builder', () => {
  it('builds a balanced SALE preview for a customer receivable sale', () => {
    const result = buildPostingPreviewLines(transaction({ customerId: 'customer_1' }), mappings());

    expect(result).toMatchObject({
      errors: [],
      isBalanced: true,
      totalCredit: '200.00',
      totalDebit: '200.00',
    });
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]).toMatchObject({
      accountName: 'Accounts Receivable',
      debitAmount: '200.00',
      mappingKey: AccountMappingKey.ACCOUNTS_RECEIVABLE,
    });
    expect(result.lines[1]).toMatchObject({
      accountName: 'Sales Revenue',
      creditAmount: '200.00',
      mappingKey: AccountMappingKey.SALES_REVENUE,
    });
  });

  it('builds a SALE preview without a customer by debiting Cash', () => {
    const result = buildPostingPreviewLines(transaction(), mappings());

    expect(result.lines[0]).toMatchObject({
      accountName: 'Cash',
      debitAmount: '200.00',
      mappingKey: AccountMappingKey.CASH,
    });
  });

  it('warns that sale inventory and COGS impact is future work', () => {
    const result = buildPostingPreviewLines(
      transaction({
        lines: [
          {
            ...transaction().lines[0]!,
            productId: 'product_1',
          },
        ],
      }),
      mappings(),
    );

    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: 'INVENTORY_COGS_NOT_INCLUDED',
      }),
    );
  });

  it('builds an EXPENSE preview that debits General Expense and credits Cash', () => {
    const result = buildPostingPreviewLines(
      transaction({ type: TransactionType.EXPENSE }),
      mappings(),
    );

    expect(result.lines).toMatchObject([
      { accountName: 'General Expense', debitAmount: '200.00' },
      { accountName: 'Cash', creditAmount: '200.00' },
    ]);
  });

  it('builds PURCHASE previews for inventory/payable and expense/cash variants', () => {
    const inventoryPurchase = buildPostingPreviewLines(
      transaction({
        lines: [{ ...transaction().lines[0]!, productId: 'product_1' }],
        supplierId: 'supplier_1',
        type: TransactionType.PURCHASE,
      }),
      mappings(),
    );

    expect(inventoryPurchase.lines).toMatchObject([
      { accountName: 'Inventory Asset', debitAmount: '200.00' },
      { accountName: 'Accounts Payable', creditAmount: '200.00' },
    ]);

    const cashPurchase = buildPostingPreviewLines(
      transaction({ type: TransactionType.PURCHASE }),
      mappings(),
    );

    expect(cashPurchase.lines).toMatchObject([
      { accountName: 'General Expense', debitAmount: '200.00' },
      { accountName: 'Cash', creditAmount: '200.00' },
    ]);
  });

  it('builds CUSTOMER_PAYMENT and SUPPLIER_PAYMENT previews', () => {
    const customerPayment = buildPostingPreviewLines(
      transaction({ type: TransactionType.CUSTOMER_PAYMENT }),
      mappings(),
    );
    const supplierPayment = buildPostingPreviewLines(
      transaction({ type: TransactionType.SUPPLIER_PAYMENT }),
      mappings(),
    );

    expect(customerPayment.lines).toMatchObject([
      { accountName: 'Cash', debitAmount: '200.00' },
      { accountName: 'Accounts Receivable', creditAmount: '200.00' },
    ]);
    expect(supplierPayment.lines).toMatchObject([
      { accountName: 'Accounts Payable', debitAmount: '200.00' },
      { accountName: 'Cash', creditAmount: '200.00' },
    ]);
  });

  it('rejects ADJUSTMENT previews safely', () => {
    const result = buildPostingPreviewLines(
      transaction({ type: TransactionType.ADJUSTMENT }),
      mappings(),
    );

    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'ADJUSTMENT_REQUIRES_EXPLICIT_ACCOUNTS',
      }),
    );
  });

  it('fails for missing, inactive/deleted, and wrong-type mappings', () => {
    expect(
      buildPostingPreviewLines(transaction(), mappings({ [AccountMappingKey.CASH]: undefined }))
        .errors,
    ).toContainEqual(expect.objectContaining({ code: 'MISSING_ACCOUNT_MAPPING' }));

    expect(
      buildPostingPreviewLines(
        transaction(),
        mappings({
          [AccountMappingKey.CASH]: {
            ...mappings()[AccountMappingKey.CASH]!,
            account: accountFor(AccountMappingKey.CASH, { isActive: false }),
          },
        }),
      ).errors,
    ).toContainEqual(expect.objectContaining({ code: 'INACTIVE_OR_DELETED_MAPPED_ACCOUNT' }));

    expect(
      buildPostingPreviewLines(
        transaction(),
        mappings({
          [AccountMappingKey.CASH]: {
            ...mappings()[AccountMappingKey.CASH]!,
            account: accountFor(AccountMappingKey.CASH, { type: AccountType.EXPENSE }),
          },
        }),
      ).errors,
    ).toContainEqual(expect.objectContaining({ code: 'WRONG_MAPPED_ACCOUNT_TYPE' }));
  });

  it('fails generated unbalanced preview lines', () => {
    expect(
      validateGeneratedPreviewLines([
        { creditAmount: '0.00', debitAmount: '200.00' },
        { creditAmount: '199.00', debitAmount: '0.00' },
      ]),
    ).toMatchObject({ code: 'UNBALANCED_PREVIEW' });
  });
});
