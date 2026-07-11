import { ForbiddenException } from '@nestjs/common';
import { BusinessMemberStatus, BusinessRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { requiredBusinessPermissionsMetadataKey } from '../decorators/require-business-permission.decorator';
import { requiredBusinessRolesMetadataKey } from '../decorators/require-business-role.decorator';
import type { BusinessPermission } from '../permissions/business-permissions';
import { BusinessMembershipGuard } from './business-membership.guard';

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
const activeMembership = {
  business,
  businessId: business.id,
  createdAt: now,
  id: 'member_1',
  invitedById: null,
  role: BusinessRole.OWNER as BusinessRole,
  status: BusinessMemberStatus.ACTIVE,
  updatedAt: now,
  userId: 'user_1',
};

function createContext(request: Record<string, unknown>) {
  return {
    getClass: vi.fn(),
    getHandler: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}

function createGuard(options: {
  membership: typeof activeMembership | null;
  requiredPermissions?: BusinessPermission[];
  requiredRoles?: BusinessRole[];
}) {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) => {
      if (key === requiredBusinessRolesMetadataKey) {
        return options.requiredRoles;
      }

      if (key === requiredBusinessPermissionsMetadataKey) {
        return options.requiredPermissions;
      }

      return undefined;
    }),
  };
  const prisma = {
    businessMember: {
      findFirst: vi.fn().mockResolvedValue(options.membership),
    },
  };

  return {
    guard: new BusinessMembershipGuard(reflector as never, prisma as never),
    prisma,
  };
}

describe('BusinessMembershipGuard', () => {
  it('attaches current business context for active members', async () => {
    const request = {
      params: { businessId: business.id },
      user: {
        email: 'daoud@example.com',
        role: 'USER',
        userId: 'user_1',
      },
    };
    const { guard, prisma } = createGuard({
      membership: activeMembership,
      requiredRoles: [BusinessRole.OWNER, BusinessRole.ADMIN],
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(prisma.businessMember.findFirst).toHaveBeenCalledWith({
      include: { business: true },
      where: {
        businessId: business.id,
        status: BusinessMemberStatus.ACTIVE,
        userId: 'user_1',
        business: {
          deletedAt: null,
        },
      },
    });
    expect(request).toHaveProperty('currentBusiness.business.id', business.id);
  });

  it('denies non-members and suspended or removed memberships', async () => {
    const request = {
      params: { businessId: business.id },
      user: {
        email: 'outsider@example.com',
        role: 'USER',
        userId: 'user_2',
      },
    };
    const { guard } = createGuard({
      membership: null,
    });

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies active members without the required role', async () => {
    const request = {
      params: { businessId: business.id },
      user: {
        email: 'viewer@example.com',
        role: 'USER',
        userId: 'user_1',
      },
    };
    const { guard } = createGuard({
      membership: {
        ...activeMembership,
        role: BusinessRole.VIEWER,
      },
      requiredRoles: [BusinessRole.OWNER, BusinessRole.ADMIN],
    });

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies viewers when a mutating accounting permission is required', async () => {
    const request = {
      params: { businessId: business.id },
      user: {
        email: 'viewer@example.com',
        role: 'USER',
        userId: 'user_1',
      },
    };
    const { guard } = createGuard({
      membership: {
        ...activeMembership,
        role: BusinessRole.VIEWER,
      },
      requiredPermissions: ['transactions.create'],
    });

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows staff to create transactions through permission mapping', async () => {
    const request = {
      params: { businessId: business.id },
      user: {
        email: 'staff@example.com',
        role: 'USER',
        userId: 'user_1',
      },
    };
    const { guard } = createGuard({
      membership: {
        ...activeMembership,
        role: BusinessRole.STAFF,
      },
      requiredPermissions: ['transactions.create'],
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
  });

  it('allows viewers to read accounts through permission mapping', async () => {
    const request = {
      params: { businessId: business.id },
      user: {
        email: 'viewer@example.com',
        role: 'USER',
        userId: 'user_1',
      },
    };
    const { guard } = createGuard({
      membership: {
        ...activeMembership,
        role: BusinessRole.VIEWER,
      },
      requiredPermissions: ['accounts.read'],
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
  });

  it('denies viewers when account management is required', async () => {
    const request = {
      params: { businessId: business.id },
      user: {
        email: 'viewer@example.com',
        role: 'USER',
        userId: 'user_1',
      },
    };
    const { guard } = createGuard({
      membership: {
        ...activeMembership,
        role: BusinessRole.VIEWER,
      },
      requiredPermissions: ['accounts.manage'],
    });

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows accountants to manage accounts and account mappings', async () => {
    const request = {
      params: { businessId: business.id },
      user: {
        email: 'accountant@example.com',
        role: 'USER',
        userId: 'user_1',
      },
    };
    const { guard } = createGuard({
      membership: {
        ...activeMembership,
        role: BusinessRole.ACCOUNTANT,
      },
      requiredPermissions: ['accounts.manage', 'accountMappings.manage'],
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
  });

  it('allows viewers to read journal entries through permission mapping', async () => {
    const request = {
      params: { businessId: business.id },
      user: {
        email: 'viewer@example.com',
        role: 'USER',
        userId: 'user_1',
      },
    };
    const { guard } = createGuard({
      membership: {
        ...activeMembership,
        role: BusinessRole.VIEWER,
      },
      requiredPermissions: ['journalEntries.read'],
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
  });

  it('denies viewers when draft journal creation is required', async () => {
    const request = {
      params: { businessId: business.id },
      user: {
        email: 'viewer@example.com',
        role: 'USER',
        userId: 'user_1',
      },
    };
    const { guard } = createGuard({
      membership: {
        ...activeMembership,
        role: BusinessRole.VIEWER,
      },
      requiredPermissions: ['journalEntries.createDraft'],
    });

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows accountants to create draft journal entries', async () => {
    const request = {
      params: { businessId: business.id },
      user: {
        email: 'accountant@example.com',
        role: 'USER',
        userId: 'user_1',
      },
    };
    const { guard } = createGuard({
      membership: {
        ...activeMembership,
        role: BusinessRole.ACCOUNTANT,
      },
      requiredPermissions: ['journalEntries.createDraft'],
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
  });

  it('denies viewers from requesting posting previews', async () => {
    const request = {
      params: { businessId: business.id },
      user: {
        email: 'viewer@example.com',
        role: 'USER',
        userId: 'user_1',
      },
    };
    const { guard } = createGuard({
      membership: {
        ...activeMembership,
        role: BusinessRole.VIEWER,
      },
      requiredPermissions: ['postingPreview.read'],
    });

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows accountants and owners to request posting previews', async () => {
    const request = {
      params: { businessId: business.id },
      user: {
        email: 'accountant@example.com',
        role: 'USER',
        userId: 'user_1',
      },
    };
    const accountantGuard = createGuard({
      membership: {
        ...activeMembership,
        role: BusinessRole.ACCOUNTANT,
      },
      requiredPermissions: ['postingPreview.read'],
    }).guard;
    const ownerGuard = createGuard({
      membership: activeMembership,
      requiredPermissions: ['postingPreview.read'],
    }).guard;

    await expect(accountantGuard.canActivate(createContext(request))).resolves.toBe(true);
    await expect(ownerGuard.canActivate(createContext(request))).resolves.toBe(true);
  });

  it('denies viewers and staff from posting journal entries', async () => {
    const request = {
      params: { businessId: business.id },
      user: {
        email: 'staff@example.com',
        role: 'USER',
        userId: 'user_1',
      },
    };
    const viewerGuard = createGuard({
      membership: {
        ...activeMembership,
        role: BusinessRole.VIEWER,
      },
      requiredPermissions: ['journalEntries.post'],
    }).guard;
    const staffGuard = createGuard({
      membership: {
        ...activeMembership,
        role: BusinessRole.STAFF,
      },
      requiredPermissions: ['journalEntries.post'],
    }).guard;

    await expect(viewerGuard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(staffGuard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows accountants to post journal entries through permission mapping', async () => {
    const request = {
      params: { businessId: business.id },
      user: {
        email: 'accountant@example.com',
        role: 'USER',
        userId: 'user_1',
      },
    };
    const { guard } = createGuard({
      membership: {
        ...activeMembership,
        role: BusinessRole.ACCOUNTANT,
      },
      requiredPermissions: ['journalEntries.post'],
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
  });

  it('denies viewers and staff from managing or previewing adjustments', async () => {
    const request = {
      params: { businessId: business.id },
      user: {
        email: 'staff@example.com',
        role: 'USER',
        userId: 'user_1',
      },
    };
    const viewerGuard = createGuard({
      membership: {
        ...activeMembership,
        role: BusinessRole.VIEWER,
      },
      requiredPermissions: ['adjustments.read', 'adjustments.preview'],
    }).guard;
    const staffGuard = createGuard({
      membership: {
        ...activeMembership,
        role: BusinessRole.STAFF,
      },
      requiredPermissions: ['adjustments.manage'],
    }).guard;

    await expect(viewerGuard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(staffGuard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows accountants to manage and preview adjustments through permission mapping', async () => {
    const request = {
      params: { businessId: business.id },
      user: {
        email: 'accountant@example.com',
        role: 'USER',
        userId: 'user_1',
      },
    };
    const { guard } = createGuard({
      membership: {
        ...activeMembership,
        role: BusinessRole.ACCOUNTANT,
      },
      requiredPermissions: ['adjustments.read', 'adjustments.manage', 'adjustments.preview'],
    });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
  });
});
