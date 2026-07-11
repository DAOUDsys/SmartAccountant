import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountMappingKey,
  AccountType,
  NormalBalance,
  Prisma,
  type Account,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AccountsService } from './accounts.service';

const now = new Date('2026-07-11T00:00:00.000Z');

const account: Account = {
  businessId: 'business_1',
  code: '5100',
  createdAt: now,
  deletedAt: null,
  description: null,
  id: 'account_1',
  isActive: true,
  isSystem: false,
  name: 'General Expense',
  normalBalance: NormalBalance.DEBIT,
  parentId: null,
  type: AccountType.EXPENSE,
  updatedAt: now,
};

function createService(prisma: unknown) {
  return new AccountsService(prisma as never);
}

describe('AccountsService', () => {
  it('lists only active tenant accounts and applies optional filters', async () => {
    const prisma = {
      account: {
        findMany: vi.fn().mockResolvedValue([account]),
      },
    };
    const service = createService(prisma);

    const result = await service.list('business_1', {
      isActive: true,
      type: AccountType.EXPENSE,
    });

    expect(prisma.account.findMany).toHaveBeenCalledWith({
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
      where: {
        businessId: 'business_1',
        deletedAt: null,
        isActive: true,
        type: AccountType.EXPENSE,
      },
    });
    expect(result).toEqual([
      {
        businessId: 'business_1',
        code: '5100',
        createdAt: now.toISOString(),
        description: undefined,
        id: 'account_1',
        isActive: true,
        isSystem: false,
        name: 'General Expense',
        normalBalance: NormalBalance.DEBIT,
        parentId: undefined,
        type: AccountType.EXPENSE,
        updatedAt: now.toISOString(),
      },
    ]);
  });

  it('rejects unknown account type filters', async () => {
    const service = createService({});

    await expect(service.list('business_1', { type: 'UNKNOWN' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates an account with derived normal balance and same-business parent validation', async () => {
    const parent = { ...account, id: 'parent_1', type: AccountType.ASSET };
    const prisma = {
      account: {
        create: vi.fn().mockResolvedValue({ ...account, code: '5200', id: 'account_2' }),
        findFirst: vi.fn().mockResolvedValue(parent),
      },
    };
    const service = createService(prisma);

    await service.create('business_1', {
      code: '5200',
      name: 'Meals',
      parentId: 'parent_1',
      type: AccountType.EXPENSE,
    });

    expect(prisma.account.findFirst).toHaveBeenCalledWith({
      where: {
        businessId: 'business_1',
        deletedAt: null,
        id: 'parent_1',
      },
    });
    expect(prisma.account.create).toHaveBeenCalledWith({
      data: {
        businessId: 'business_1',
        code: '5200',
        description: undefined,
        isActive: true,
        name: 'Meals',
        normalBalance: NormalBalance.DEBIT,
        parentId: 'parent_1',
        type: AccountType.EXPENSE,
      },
    });
  });

  it('rejects a parent account from another tenant', async () => {
    const prisma = {
      account: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(
      service.create('business_1', {
        code: '5200',
        name: 'Meals',
        parentId: 'other_tenant_account',
        type: AccountType.EXPENSE,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects normal-balance overrides that do not match the account type', async () => {
    const service = createService({});

    await expect(
      service.create('business_1', {
        code: '5300',
        name: 'Unsafe Expense',
        normalBalance: NormalBalance.CREDIT,
        type: AccountType.EXPENSE,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns duplicate account codes as conflicts', async () => {
    const prisma = {
      account: {
        create: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            clientVersion: '6.19.3',
            code: 'P2002',
          }),
        ),
      },
    };
    const service = createService(prisma);

    await expect(
      service.create('business_1', {
        code: '5100',
        name: 'General Expense',
        type: AccountType.EXPENSE,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('prevents cross-tenant account id guessing', async () => {
    const prisma = {
      account: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(service.getById('business_1', 'account_from_business_2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.account.findFirst).toHaveBeenCalledWith({
      where: {
        businessId: 'business_1',
        deletedAt: null,
        id: 'account_from_business_2',
      },
    });
  });

  it('protects system account deletion and code/type changes', async () => {
    const systemAccount = { ...account, isSystem: true, type: AccountType.ASSET };
    const prisma = {
      account: {
        findFirst: vi.fn().mockResolvedValue(systemAccount),
      },
    };
    const service = createService(prisma);

    await expect(service.softDelete('business_1', account.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.update('business_1', account.id, {
        code: '9999',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.update('business_1', account.id, {
        type: AccountType.EXPENSE,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('soft deletes custom accounts and excludes deleted records from normal lists', async () => {
    const prisma = {
      account: {
        findFirst: vi.fn().mockResolvedValue(account),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({ ...account, deletedAt: now, isActive: false }),
      },
    };
    const service = createService(prisma);

    await service.softDelete('business_1', account.id);
    const accounts = await service.list('business_1', {});

    expect(prisma.account.update).toHaveBeenCalledWith({
      data: { deletedAt: expect.any(Date) as Date, isActive: false },
      where: { id: account.id },
    });
    expect(prisma.account.findMany).toHaveBeenCalledWith({
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
      where: {
        businessId: 'business_1',
        deletedAt: null,
        isActive: undefined,
        type: undefined,
      },
    });
    expect(accounts).toEqual([]);
  });

  it('requires account mappings to point to active same-business accounts', async () => {
    const prisma = {
      account: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(
      service.updateMapping('business_1', AccountMappingKey.GENERAL_EXPENSE, {
        accountId: 'other_tenant_account',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.account.findFirst).toHaveBeenCalledWith({
      where: {
        businessId: 'business_1',
        deletedAt: null,
        id: 'other_tenant_account',
        isActive: true,
      },
    });
  });

  it('updates known account mappings', async () => {
    const mapping = {
      account,
      accountId: account.id,
      businessId: 'business_1',
      createdAt: now,
      id: 'mapping_1',
      key: AccountMappingKey.GENERAL_EXPENSE,
      updatedAt: now,
    };
    const prisma = {
      account: {
        findFirst: vi.fn().mockResolvedValue(account),
      },
      accountMapping: {
        upsert: vi.fn().mockResolvedValue(mapping),
      },
    };
    const service = createService(prisma);

    const result = await service.updateMapping('business_1', AccountMappingKey.GENERAL_EXPENSE, {
      accountId: account.id,
    });

    expect(prisma.accountMapping.upsert).toHaveBeenCalledWith({
      create: {
        accountId: account.id,
        businessId: 'business_1',
        key: AccountMappingKey.GENERAL_EXPENSE,
      },
      include: { account: true },
      update: {
        accountId: account.id,
      },
      where: {
        businessId_key: {
          businessId: 'business_1',
          key: AccountMappingKey.GENERAL_EXPENSE,
        },
      },
    });
    expect(result.key).toBe(AccountMappingKey.GENERAL_EXPENSE);
  });

  it('rejects unknown account mapping keys', async () => {
    const service = createService({});

    await expect(
      service.updateMapping('business_1', 'UNKNOWN', { accountId: account.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
