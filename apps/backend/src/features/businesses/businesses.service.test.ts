import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BusinessMemberStatus, BusinessRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { BusinessesService } from './businesses.service';

const now = new Date('2026-07-10T10:00:00.000Z');
const business = {
  createdAt: now,
  currency: 'USD',
  deletedAt: null,
  id: 'business_1',
  legalName: null,
  locale: 'en',
  name: 'Daoud Studio',
  ownerId: 'user_1',
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
  userId: 'user_1',
};

function createService(prisma: unknown) {
  return new BusinessesService(prisma as never);
}

describe('BusinessesService', () => {
  it('returns only active non-deleted businesses for the current user', async () => {
    const prisma = {
      businessMember: {
        findMany: vi.fn().mockResolvedValue([{ ...membership, business }]),
      },
    };
    const service = createService(prisma);

    const result = await service.listForUser('user_1');

    expect(prisma.businessMember.findMany).toHaveBeenCalledWith({
      include: { business: true },
      orderBy: { createdAt: 'asc' },
      where: {
        status: BusinessMemberStatus.ACTIVE,
        userId: 'user_1',
        business: {
          deletedAt: null,
        },
      },
    });
    expect(result).toEqual([
      {
        business: {
          createdAt: now.toISOString(),
          currency: 'USD',
          id: business.id,
          legalName: undefined,
          locale: 'en',
          name: 'Daoud Studio',
          ownerId: 'user_1',
          timezone: 'UTC',
          updatedAt: now.toISOString(),
        },
        membership: {
          businessId: business.id,
          createdAt: now.toISOString(),
          displayName: undefined,
          email: undefined,
          id: membership.id,
          role: BusinessRole.OWNER,
          status: BusinessMemberStatus.ACTIVE,
          updatedAt: now.toISOString(),
          userId: 'user_1',
        },
      },
    ]);
  });

  it('creates a new business with the current user as owner', async () => {
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
    };
    const prisma = {
      $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    };
    const service = createService(prisma);

    const result = await service.createForUser('user_1', {
      name: ' Daoud Studio ',
    });

    expect(tx.business.create).toHaveBeenCalledWith({
      data: {
        currency: undefined,
        legalName: undefined,
        locale: undefined,
        name: 'Daoud Studio',
        ownerId: 'user_1',
        timezone: undefined,
      },
    });
    expect(tx.businessMember.create).toHaveBeenCalledWith({
      data: {
        businessId: business.id,
        role: BusinessRole.OWNER,
        status: BusinessMemberStatus.ACTIVE,
        userId: 'user_1',
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
    expect(result.membership.role).toBe(BusinessRole.OWNER);
  });

  it('does not leak a deleted or missing business', async () => {
    const prisma = {
      business: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(service.getBusinessForMember('business_2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('blocks owner creation through the simple member endpoint', async () => {
    const service = createService({});

    await expect(
      service.addExistingUserMember(
        business.id,
        {
          email: 'member@example.com',
          role: BusinessRole.OWNER,
        },
        'user_1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents adding a duplicate active member', async () => {
    const prisma = {
      businessMember: {
        findUnique: vi.fn().mockResolvedValue(membership),
      },
      user: {
        findFirst: vi.fn().mockResolvedValue({
          deletedAt: null,
          email: 'member@example.com',
          id: 'user_2',
        }),
      },
    };
    const service = createService(prisma);

    await expect(
      service.addExistingUserMember(
        business.id,
        {
          email: 'member@example.com',
          role: BusinessRole.VIEWER,
        },
        'user_1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
