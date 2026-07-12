import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditActorType, AuditOutcome, AuditSource, BusinessRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AUDIT_EVENTS } from './audit-events';
import {
  AuditEventInvalidError,
  AuditFilterInvalidError,
  AuditMetadataRejectedError,
} from './audit-errors';
import { AuditLogService } from './audit-log.service';

const now = new Date('2026-07-12T07:30:00.000Z');
const user = { id: 'user_1' };
const business = { id: 'business_1' };
const accountingAuditLog = {
  action: 'create',
  actorType: AuditActorType.USER,
  actorUserId: user.id,
  businessId: business.id,
  correlationId: 'corr-1',
  createdAt: now,
  entityId: 'txn_1',
  entityType: 'Transaction',
  errorCode: null,
  eventType: AUDIT_EVENTS.TRANSACTION_CREATED,
  id: 'audit_1',
  ipAddress: '127.0.0.1',
  metadata: { transactionId: 'txn_1' },
  occurredAt: now,
  outcome: AuditOutcome.SUCCESS,
  reason: null,
  relatedEntityId: null,
  relatedEntityType: null,
  requestId: 'req-1',
  source: AuditSource.API,
  userAgent: 'Vitest',
};
const securityAuditLog = {
  ...accountingAuditLog,
  action: 'deny',
  eventType: AUDIT_EVENTS.BUSINESS_ACCESS_DENIED,
  id: 'audit_2',
  metadata: {},
};
function createPrismaMock() {
  return {
    auditLog: {
      create: vi
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ ...accountingAuditLog, ...data, id: 'audit_created' }),
        ),
      findFirst: vi.fn().mockResolvedValue(accountingAuditLog),
      findMany: vi.fn().mockResolvedValue([accountingAuditLog]),
    },
    business: {
      findFirst: vi.fn().mockResolvedValue(business),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
    },
  };
}

function createService(prisma = createPrismaMock()) {
  return { prisma, service: new AuditLogService(prisma as never) };
}

describe('AuditLogService', () => {
  it('creates a tenant audit event through the internal service', async () => {
    const { prisma, service } = createService();

    const result = await service.createEvent({
      actorType: AuditActorType.USER,
      actorUserId: user.id,
      businessId: business.id,
      entityId: 'txn_1',
      entityType: 'Transaction',
      eventType: AUDIT_EVENTS.TRANSACTION_CREATED,
      metadata: { transactionId: 'txn_1' },
      outcome: AuditOutcome.SUCCESS,
      source: AuditSource.API,
    });

    expect(result.id).toBe('audit_created');
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'create',
        businessId: business.id,
        eventType: AUDIT_EVENTS.TRANSACTION_CREATED,
        metadata: { transactionId: 'txn_1' },
      }),
    });
  });

  it('requires businessId for tenant-owned events and allows approved global events', async () => {
    const { service } = createService();

    await expect(
      service.createEvent({
        actorType: AuditActorType.USER,
        actorUserId: user.id,
        eventType: AUDIT_EVENTS.TRANSACTION_CREATED,
        outcome: AuditOutcome.SUCCESS,
        source: AuditSource.API,
      }),
    ).rejects.toBeInstanceOf(AuditEventInvalidError);

    await expect(
      service.createEvent({
        actorType: AuditActorType.SYSTEM,
        eventType: AUDIT_EVENTS.AUTH_LOGIN_FAILED,
        metadata: { attemptedEmailFingerprint: 'abc123' },
        outcome: AuditOutcome.FAILURE,
        source: AuditSource.API,
      }),
    ).resolves.toMatchObject({ eventType: AUDIT_EVENTS.AUTH_LOGIN_FAILED });
  });

  it('rejects unregistered events, mismatched actions, invalid actor/source combinations, and unsafe metadata', async () => {
    const { service } = createService();
    const base = {
      actorType: AuditActorType.USER,
      actorUserId: user.id,
      businessId: business.id,
      outcome: AuditOutcome.SUCCESS,
      source: AuditSource.API,
    };

    await expect(
      service.createEvent({ ...base, eventType: 'CLIENT_DEFINED_EVENT' }),
    ).rejects.toBeInstanceOf(AuditEventInvalidError);
    await expect(
      service.createEvent({
        ...base,
        action: 'delete',
        eventType: AUDIT_EVENTS.TRANSACTION_CREATED,
      }),
    ).rejects.toBeInstanceOf(AuditEventInvalidError);
    await expect(
      service.createEvent({
        actorType: AuditActorType.USER,
        actorUserId: user.id,
        businessId: business.id,
        eventType: AUDIT_EVENTS.TRANSACTION_CREATED,
        outcome: AuditOutcome.SUCCESS,
        source: AuditSource.BACKGROUND_JOB,
      }),
    ).rejects.toBeInstanceOf(AuditEventInvalidError);
    await expect(
      service.createEvent({
        ...base,
        eventType: AUDIT_EVENTS.TRANSACTION_CREATED,
        metadata: { password: 'nope' },
      }),
    ).rejects.toBeInstanceOf(AuditMetadataRejectedError);
  });

  it('validates actor users when provided', async () => {
    const prisma = createPrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    const { service } = createService(prisma);

    await expect(
      service.createEvent({
        actorType: AuditActorType.USER,
        actorUserId: user.id,
        businessId: business.id,
        eventType: AUDIT_EVENTS.TRANSACTION_CREATED,
        outcome: AuditOutcome.SUCCESS,
        source: AuditSource.API,
      }),
    ).rejects.toBeInstanceOf(AuditEventInvalidError);
  });

  it('supports Prisma transaction client injection', async () => {
    const { service } = createService();
    const tx = createPrismaMock();

    await service.createEvent(
      {
        actorType: AuditActorType.USER,
        actorUserId: user.id,
        businessId: business.id,
        eventType: AUDIT_EVENTS.TRANSACTION_CREATED,
        outcome: AuditOutcome.SUCCESS,
        source: AuditSource.API,
      },
      tx as never,
    );

    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });

  it('exposes no normal update or delete methods', () => {
    const { service } = createService();
    expect('update' in service).toBe(false);
    expect('delete' in service).toBe(false);
    expect('updateMany' in service).toBe(false);
    expect('deleteMany' in service).toBe(false);
  });

  it('lists tenant events newest-first with default and maximum bounded page sizes', async () => {
    const prisma = createPrismaMock();
    prisma.auditLog.findMany.mockResolvedValue(
      Array.from({ length: 26 }, (_, index) => ({
        ...accountingAuditLog,
        id: `audit_${index}`,
      })),
    );
    const { service } = createService(prisma);

    const result = await service.findBusinessEvents(business.id, BusinessRole.OWNER, {});

    expect(result.items).toHaveLength(25);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toEqual(expect.any(String));
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 26,
        where: expect.objectContaining({ businessId: business.id }),
      }),
    );

    await service.findBusinessEvents(business.id, BusinessRole.OWNER, { limit: '1000' });
    expect(prisma.auditLog.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 101 }),
    );
  });

  it('applies tenant-scoped event, entity, actor, date, request, and correlation filters', async () => {
    const { prisma, service } = createService();

    await service.findBusinessEvents(business.id, BusinessRole.OWNER, {
      actorUserId: user.id,
      correlationId: 'corr-1',
      dateFrom: '2026-07-01T00:00:00.000Z',
      dateTo: '2026-07-31T00:00:00.000Z',
      entityId: 'txn_1',
      entityType: 'Transaction',
      eventType: AUDIT_EVENTS.TRANSACTION_CREATED,
      outcome: AuditOutcome.SUCCESS,
      requestId: 'req-1',
    });

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actorUserId: user.id,
          businessId: business.id,
          correlationId: 'corr-1',
          entityId: 'txn_1',
          entityType: 'Transaction',
          eventType: AUDIT_EVENTS.TRANSACTION_CREATED,
          outcome: AuditOutcome.SUCCESS,
          requestId: 'req-1',
        }),
      }),
    );
  });

  it('rejects invalid filters safely', async () => {
    const { service } = createService();

    await expect(
      service.findBusinessEvents(business.id, BusinessRole.OWNER, { eventType: 'NOPE' }),
    ).rejects.toBeInstanceOf(AuditFilterInvalidError);
    await expect(
      service.findBusinessEvents(business.id, BusinessRole.OWNER, { outcome: 'NOPE' }),
    ).rejects.toBeInstanceOf(AuditFilterInvalidError);
    await expect(
      service.findBusinessEvents(business.id, BusinessRole.OWNER, {
        dateFrom: '2026-08-01T00:00:00.000Z',
        dateTo: '2026-07-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(AuditFilterInvalidError);
  });

  it('excludes global events from tenant lists and hides cross-tenant cursors', async () => {
    const prisma = createPrismaMock();
    prisma.auditLog.findMany.mockResolvedValue([accountingAuditLog]);
    const { service } = createService(prisma);
    await service.findBusinessEvents(business.id, BusinessRole.OWNER, {});
    const otherCursor = Buffer.from(
      JSON.stringify({ businessId: 'business_2', id: 'audit_9', occurredAt: now.toISOString() }),
      'utf8',
    ).toString('base64url');

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ businessId: business.id }) }),
    );
    await expect(
      service.findBusinessEvents(business.id, BusinessRole.OWNER, { cursor: otherCursor }),
    ).rejects.toBeInstanceOf(AuditFilterInvalidError);
  });

  it('allows OWNER and ADMIN to read security events but ACCOUNTANT can only query accounting event categories', async () => {
    const prisma = createPrismaMock();
    const { service } = createService(prisma);

    await service.findBusinessEvents(business.id, BusinessRole.OWNER, {});
    expect(prisma.auditLog.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventType: expect.objectContaining({
            in: expect.arrayContaining([AUDIT_EVENTS.BUSINESS_ACCESS_DENIED]),
          }),
        }),
      }),
    );

    await service.findBusinessEvents(business.id, BusinessRole.ADMIN, {});
    expect(prisma.auditLog.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventType: expect.objectContaining({
            in: expect.arrayContaining([AUDIT_EVENTS.AUTH_LOGIN_FAILED]),
          }),
        }),
      }),
    );

    await service.findBusinessEvents(business.id, BusinessRole.ACCOUNTANT, {});
    expect(prisma.auditLog.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventType: expect.objectContaining({
            in: expect.not.arrayContaining([AUDIT_EVENTS.BUSINESS_ACCESS_DENIED]),
          }),
        }),
      }),
    );
  });

  it('denies STAFF and VIEWER audit reads', async () => {
    const { service } = createService();

    await expect(
      service.findBusinessEvents(business.id, BusinessRole.STAFF, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.findBusinessEvents(business.id, BusinessRole.VIEWER, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('hides security event detail from accountants and hides cross-tenant detail safely', async () => {
    const prisma = createPrismaMock();
    prisma.auditLog.findFirst
      .mockResolvedValueOnce(securityAuditLog)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const { service } = createService(prisma);

    await expect(
      service.findBusinessEventById(business.id, 'audit_2', BusinessRole.OWNER),
    ).resolves.toMatchObject({
      eventType: AUDIT_EVENTS.BUSINESS_ACCESS_DENIED,
    });
    await expect(
      service.findBusinessEventById(business.id, 'audit_2', BusinessRole.ACCOUNTANT),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.findBusinessEventById('business_2', 'audit_1', BusinessRole.OWNER),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns sanitized response fields without relation internals', async () => {
    const { service } = createService();

    const result = await service.findBusinessEventById(business.id, 'audit_1', BusinessRole.OWNER);

    expect(result).toMatchObject({
      actorUserId: user.id,
      businessId: business.id,
      createdAt: now.toISOString(),
      metadata: { transactionId: 'txn_1' },
      occurredAt: now.toISOString(),
    });
    expect(result).not.toHaveProperty('business');
    expect(result).not.toHaveProperty('actorUser');
  });
});
