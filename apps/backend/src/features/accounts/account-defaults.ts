import {
  AccountMappingKey,
  AccountType,
  NormalBalance,
  type Account,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import type { PrismaService } from '../../database/prisma.service';

type PrismaAccountClient = Prisma.TransactionClient | PrismaService | PrismaClient;

export interface DefaultAccountDefinition {
  code: string;
  description: string;
  name: string;
  normalBalance: NormalBalance;
  type: AccountType;
}

export const defaultSystemAccounts: DefaultAccountDefinition[] = [
  {
    code: '1000',
    description: 'Default cash account for immediate cash payments and receipts.',
    name: 'Cash',
    normalBalance: NormalBalance.DEBIT,
    type: AccountType.ASSET,
  },
  {
    code: '1100',
    description: 'Default receivables account for customer balances.',
    name: 'Accounts Receivable',
    normalBalance: NormalBalance.DEBIT,
    type: AccountType.ASSET,
  },
  {
    code: '1200',
    description: 'Default inventory asset account for future inventory posting.',
    name: 'Inventory Asset',
    normalBalance: NormalBalance.DEBIT,
    type: AccountType.ASSET,
  },
  {
    code: '2000',
    description: 'Default payables account for supplier balances.',
    name: 'Accounts Payable',
    normalBalance: NormalBalance.CREDIT,
    type: AccountType.LIABILITY,
  },
  {
    code: '3000',
    description: 'Default owner equity account.',
    name: 'Owner Equity',
    normalBalance: NormalBalance.CREDIT,
    type: AccountType.EQUITY,
  },
  {
    code: '4000',
    description: 'Default revenue account for future sales posting.',
    name: 'Sales Revenue',
    normalBalance: NormalBalance.CREDIT,
    type: AccountType.REVENUE,
  },
  {
    code: '5000',
    description: 'Default cost account for future cost of goods sold posting.',
    name: 'Cost of Goods Sold',
    normalBalance: NormalBalance.DEBIT,
    type: AccountType.EXPENSE,
  },
  {
    code: '5100',
    description: 'Default expense account for uncategorized operating expenses.',
    name: 'General Expense',
    normalBalance: NormalBalance.DEBIT,
    type: AccountType.EXPENSE,
  },
];

export const defaultAccountMappings: Record<AccountMappingKey, string> = {
  [AccountMappingKey.CASH]: '1000',
  [AccountMappingKey.ACCOUNTS_RECEIVABLE]: '1100',
  [AccountMappingKey.INVENTORY_ASSET]: '1200',
  [AccountMappingKey.ACCOUNTS_PAYABLE]: '2000',
  [AccountMappingKey.OWNER_EQUITY]: '3000',
  [AccountMappingKey.SALES_REVENUE]: '4000',
  [AccountMappingKey.COST_OF_GOODS_SOLD]: '5000',
  [AccountMappingKey.GENERAL_EXPENSE]: '5100',
};

export function getNormalBalanceForAccountType(type: AccountType): NormalBalance {
  return type === AccountType.ASSET || type === AccountType.EXPENSE
    ? NormalBalance.DEBIT
    : NormalBalance.CREDIT;
}

export async function createDefaultAccountsForBusiness(
  prisma: PrismaAccountClient,
  businessId: string,
): Promise<Account[]> {
  const accounts = await Promise.all(
    defaultSystemAccounts.map((account) =>
      prisma.account.upsert({
        create: {
          businessId,
          code: account.code,
          description: account.description,
          isActive: true,
          isSystem: true,
          name: account.name,
          normalBalance: account.normalBalance,
          type: account.type,
        },
        update: {
          description: account.description,
          isSystem: true,
          name: account.name,
          normalBalance: account.normalBalance,
          type: account.type,
        },
        where: {
          businessId_code: {
            businessId,
            code: account.code,
          },
        },
      }),
    ),
  );

  const accountByCode = new Map(accounts.map((account) => [account.code, account]));

  await Promise.all(
    Object.entries(defaultAccountMappings).map(([key, code]) => {
      const account = accountByCode.get(code);

      if (!account) {
        throw new Error(`Default account ${code} was not created for business ${businessId}.`);
      }

      return prisma.accountMapping.upsert({
        create: {
          accountId: account.id,
          businessId,
          key: key as AccountMappingKey,
        },
        update: {
          accountId: account.id,
        },
        where: {
          businessId_key: {
            businessId,
            key: key as AccountMappingKey,
          },
        },
      });
    }),
  );

  return accounts;
}
