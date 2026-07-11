import { AccountMappingKey, AccountType, NormalBalance, type Account } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  createDefaultAccountsForBusiness,
  defaultAccountMappings,
  defaultSystemAccounts,
  getNormalBalanceForAccountType,
} from './account-defaults';

const now = new Date('2026-07-11T00:00:00.000Z');

function accountFromCreate(data: Partial<Account> & Pick<Account, 'businessId' | 'code'>): Account {
  return {
    businessId: data.businessId,
    code: data.code,
    createdAt: now,
    deletedAt: null,
    description: data.description ?? null,
    id: `${data.businessId}_${data.code}`,
    isActive: data.isActive ?? true,
    isSystem: data.isSystem ?? true,
    name: data.name ?? data.code,
    normalBalance: data.normalBalance ?? NormalBalance.DEBIT,
    parentId: data.parentId ?? null,
    type: data.type ?? AccountType.ASSET,
    updatedAt: now,
  };
}

describe('account defaults', () => {
  it('derives normal balance from account type', () => {
    expect(getNormalBalanceForAccountType(AccountType.ASSET)).toBe(NormalBalance.DEBIT);
    expect(getNormalBalanceForAccountType(AccountType.EXPENSE)).toBe(NormalBalance.DEBIT);
    expect(getNormalBalanceForAccountType(AccountType.LIABILITY)).toBe(NormalBalance.CREDIT);
    expect(getNormalBalanceForAccountType(AccountType.EQUITY)).toBe(NormalBalance.CREDIT);
    expect(getNormalBalanceForAccountType(AccountType.REVENUE)).toBe(NormalBalance.CREDIT);
  });

  it('creates default system accounts and mappings for a business idempotently', async () => {
    const prisma = {
      account: {
        upsert: vi.fn((args) => Promise.resolve(accountFromCreate(args.create))),
      },
      accountMapping: {
        upsert: vi.fn((args) => Promise.resolve({ ...args.create, id: `${args.create.key}_map` })),
      },
    };

    const accounts = await createDefaultAccountsForBusiness(prisma as never, 'business_1');

    expect(accounts).toHaveLength(defaultSystemAccounts.length);
    expect(prisma.account.upsert).toHaveBeenCalledTimes(defaultSystemAccounts.length);
    expect(prisma.accountMapping.upsert).toHaveBeenCalledTimes(
      Object.keys(defaultAccountMappings).length,
    );
    expect(prisma.account.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          businessId: 'business_1',
          code: '1000',
          isSystem: true,
          name: 'Cash',
        }),
        where: {
          businessId_code: {
            businessId: 'business_1',
            code: '1000',
          },
        },
      }),
    );
    expect(prisma.accountMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          businessId: 'business_1',
          key: AccountMappingKey.CASH,
        }),
        where: {
          businessId_key: {
            businessId: 'business_1',
            key: AccountMappingKey.CASH,
          },
        },
      }),
    );
  });

  it('allows the same default code in two different businesses', async () => {
    const prisma = {
      account: {
        upsert: vi.fn((args) => Promise.resolve(accountFromCreate(args.create))),
      },
      accountMapping: {
        upsert: vi.fn((args) => Promise.resolve({ ...args.create, id: `${args.create.key}_map` })),
      },
    };

    await createDefaultAccountsForBusiness(prisma as never, 'business_1');
    await createDefaultAccountsForBusiness(prisma as never, 'business_2');

    expect(prisma.account.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId_code: {
            businessId: 'business_1',
            code: '1000',
          },
        },
      }),
    );
    expect(prisma.account.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId_code: {
            businessId: 'business_2',
            code: '1000',
          },
        },
      }),
    );
  });
});
