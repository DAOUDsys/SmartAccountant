import { ConflictException } from '@nestjs/common';
import { BusinessMemberStatus, BusinessRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AuthService, authTestUtils } from './auth.service';

function createService(prisma: unknown) {
  return new AuthService(
    {
      getOrThrow: vi.fn(),
    } as never,
    {
      signAsync: vi.fn(),
    } as never,
    prisma as never,
  );
}

describe('AuthService', () => {
  it('normalizes email addresses before lookup', () => {
    expect(authTestUtils.normalizeEmail('  USER@Example.COM ')).toBe('user@example.com');
  });

  it('parses supported token durations in seconds', () => {
    expect(authTestUtils.parseDurationSeconds('15m')).toBe(900);
    expect(authTestUtils.parseDurationSeconds('30d')).toBe(2_592_000);
  });

  it('serializes users without password hashes or deleted timestamps', () => {
    const service = createService({});
    const safeUser = service.toSafeUser({
      createdAt: new Date('2026-07-10T10:00:00.000Z'),
      deletedAt: null,
      displayName: 'Daoud',
      email: 'daoud@example.com',
      id: 'user_1',
      passwordHash: 'secret-hash',
      role: 'USER',
      updatedAt: new Date('2026-07-10T10:05:00.000Z'),
    });

    expect(safeUser).toEqual({
      createdAt: '2026-07-10T10:00:00.000Z',
      displayName: 'Daoud',
      email: 'daoud@example.com',
      id: 'user_1',
      role: 'USER',
      updatedAt: '2026-07-10T10:05:00.000Z',
    });
    expect(safeUser).not.toHaveProperty('passwordHash');
    expect(safeUser).not.toHaveProperty('deletedAt');
  });

  it('rejects duplicate registration emails after normalization', async () => {
    const prisma = {
      user: {
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ id: 'existing_user' }),
      },
    };
    const service = createService(prisma);

    await expect(
      service.register(
        {
          email: 'USER@Example.COM',
          password: 'Password123',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'user@example.com' },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('creates a default business and owner membership during registration', async () => {
    const now = new Date('2026-07-10T10:00:00.000Z');
    const user = {
      createdAt: now,
      deletedAt: null,
      displayName: 'Daoud',
      email: 'daoud@example.com',
      id: 'user_1',
      passwordHash: 'hashed-password',
      role: 'USER',
      updatedAt: now,
    };
    const business = {
      createdAt: now,
      currency: 'USD',
      deletedAt: null,
      id: 'business_1',
      legalName: null,
      locale: 'en',
      name: "Daoud's Business",
      ownerId: user.id,
      timezone: 'UTC',
      updatedAt: now,
    };
    const membership = {
      businessId: business.id,
      createdAt: now,
      id: 'member_1',
      invitedById: null,
      role: BusinessRole.OWNER,
      status: BusinessMemberStatus.ACTIVE,
      updatedAt: now,
      userId: user.id,
    };
    const tx = {
      account: {
        upsert: vi.fn((args) =>
          Promise.resolve({
            ...args.create,
            createdAt: now,
            deletedAt: null,
            id: `${args.create.businessId}_${args.create.code}`,
            parentId: null,
            updatedAt: now,
          }),
        ),
      },
      accountMapping: {
        upsert: vi.fn((args) => Promise.resolve({ ...args.create, id: `${args.create.key}_map` })),
      },
      business: {
        create: vi.fn().mockResolvedValue(business),
      },
      businessMember: {
        create: vi.fn().mockResolvedValue(membership),
      },
      refreshToken: {
        create: vi.fn().mockResolvedValue({ id: 'refresh_1' }),
      },
      user: {
        create: vi.fn().mockResolvedValue(user),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback) => callback(tx)),
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const configService = {
      getOrThrow: vi.fn((key: string) => {
        const values: Record<string, string | number> = {
          'auth.bcryptRounds': 4,
          'auth.jwtAccessExpiresIn': '15m',
          'auth.jwtAccessSecret': 'test-secret',
          'auth.jwtRefreshExpiresIn': '30d',
        };

        return values[key];
      }),
    };
    const jwtService = {
      signAsync: vi.fn().mockResolvedValue('access-token'),
    };
    const service = new AuthService(configService as never, jwtService as never, prisma as never);

    const response = await service.register(
      {
        displayName: 'Daoud',
        email: 'DAOUD@Example.COM',
        password: 'Password123',
      },
      {},
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        displayName: 'Daoud',
        email: 'daoud@example.com',
        passwordHash: expect.any(String) as string,
      },
    });
    expect(tx.business.create).toHaveBeenCalledWith({
      data: {
        name: "Daoud's Business",
        ownerId: user.id,
      },
    });
    expect(tx.businessMember.create).toHaveBeenCalledWith({
      data: {
        businessId: business.id,
        role: BusinessRole.OWNER,
        status: BusinessMemberStatus.ACTIVE,
        userId: user.id,
      },
    });
    expect(tx.account.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          businessId: business.id,
          code: '1000',
          isSystem: true,
          name: 'Cash',
        }),
      }),
    );
    expect(tx.accountMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          businessId: business.id,
          key: 'CASH',
        }),
      }),
    );
    expect(tx.refreshToken.create).toHaveBeenCalledWith({
      data: {
        expiresAt: expect.any(Date) as Date,
        ipAddress: undefined,
        tokenHash: expect.any(String) as string,
        userAgent: undefined,
        userId: user.id,
      },
    });
    expect(response.businessContext).toEqual({
      business: {
        createdAt: now.toISOString(),
        currency: 'USD',
        id: business.id,
        legalName: undefined,
        locale: 'en',
        name: "Daoud's Business",
        ownerId: user.id,
        timezone: 'UTC',
        updatedAt: now.toISOString(),
      },
      membership: {
        businessId: business.id,
        createdAt: now.toISOString(),
        id: membership.id,
        role: BusinessRole.OWNER,
        status: BusinessMemberStatus.ACTIVE,
        updatedAt: now.toISOString(),
        userId: user.id,
      },
    });
  });
});
