import { AuditActorType, AuditOutcome, AuditSource } from '@prisma/client';
import type { AuditLog, BusinessRole, Prisma } from '@prisma/client';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  auditEventCatalog,
  getAuditEventDefinition,
  isKnownAuditEvent,
  readableAuditCategoriesForRole,
} from './audit-events';
import type { AuditMetadataInput } from './audit-metadata.validator';
import { validateAndSanitizeAuditMetadata } from './audit-metadata.validator';
import {
  AuditAccessDeniedError,
  AuditEventInvalidError,
  AuditFilterInvalidError,
  AuditLogNotFoundError,
  AuditWriteFailedError,
} from './audit-errors';
import { truncateForAudit } from './audit-redaction.util';

type AuditPrismaClient = PrismaService | Prisma.TransactionClient;

export interface CreateAuditEventInput {
  action?: string;
  actorType: AuditActorType;
  actorUserId?: string;
  businessId?: string;
  correlationId?: string;
  entityId?: string;
  entityType?: string;
  errorCode?: string;
  eventType: string;
  ipAddress?: string;
  metadata?: AuditMetadataInput;
  occurredAt?: Date;
  outcome: AuditOutcome;
  reason?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  requestId?: string;
  source: AuditSource;
  userAgent?: string;
}

export interface AuditLogFilters {
  actorUserId?: string;
  correlationId?: string;
  cursor?: string;
  dateFrom?: string;
  dateTo?: string;
  entityId?: string;
  entityType?: string;
  eventType?: string;
  limit?: string;
  outcome?: string;
  requestId?: string;
}

export interface AuditLogListResponse {
  hasMore: boolean;
  items: AuditLogResponse[];
  nextCursor?: string;
}

export interface AuditLogResponse {
  action: string;
  actorType: AuditActorType;
  actorUserId?: string;
  businessId?: string;
  correlationId?: string;
  createdAt: string;
  entityId?: string;
  entityType?: string;
  errorCode?: string;
  eventType: string;
  id: string;
  ipAddress?: string;
  metadata?: Prisma.JsonValue;
  occurredAt: string;
  outcome: AuditOutcome;
  reason?: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  requestId?: string;
  source: AuditSource;
  userAgent?: string;
}

interface DecodedCursor {
  businessId: string;
  id: string;
  occurredAt: string;
}

const defaultLimit = 25;
const maxLimit = 100;
const maxDateWindowMs = 366 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuditLogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createEvent(
    input: CreateAuditEventInput,
    transactionClient?: Prisma.TransactionClient,
  ): Promise<AuditLogResponse> {
    const client = transactionClient ?? this.prisma;
    const definition = getAuditEventDefinition(input.eventType);

    if (!definition || !isKnownAuditEvent(input.eventType)) {
      throw new AuditEventInvalidError('Audit event type is not registered.');
    }

    const action = input.action ?? definition.action;
    if (action !== definition.action || !/^[a-z][a-z._:-]{0,49}$/.test(action)) {
      throw new AuditEventInvalidError('Audit action is not allowed for this event.');
    }

    if (definition.requiresBusinessId && !input.businessId) {
      throw new AuditEventInvalidError('Tenant-owned audit events require businessId.');
    }

    this.validateActorAndSource(input);
    await this.validateReferences(client, input);

    const metadata = validateAndSanitizeAuditMetadata(
      input.metadata,
      definition.allowedMetadataKeys,
    );

    try {
      const created = await client.auditLog.create({
        data: {
          action,
          actorType: input.actorType,
          actorUserId: input.actorUserId,
          businessId: input.businessId,
          correlationId: truncateForAudit(input.correlationId, 100),
          entityId: input.entityId,
          entityType: truncateForAudit(input.entityType, 100),
          errorCode: truncateForAudit(input.errorCode, 100),
          eventType: input.eventType,
          ipAddress: truncateForAudit(input.ipAddress, 64),
          metadata,
          occurredAt: input.occurredAt ?? new Date(),
          outcome: input.outcome,
          reason: truncateForAudit(input.reason, 500),
          relatedEntityId: input.relatedEntityId,
          relatedEntityType: truncateForAudit(input.relatedEntityType, 100),
          requestId: truncateForAudit(input.requestId, 100),
          source: input.source,
          userAgent: truncateForAudit(input.userAgent, 512),
        },
      });

      return this.toResponse(created);
    } catch (error) {
      if (error instanceof AuditEventInvalidError) {
        throw error;
      }

      throw new AuditWriteFailedError();
    }
  }

  async findBusinessEvents(
    businessId: string,
    role: BusinessRole,
    filters: AuditLogFilters,
  ): Promise<AuditLogListResponse> {
    this.assertRoleCanReadAudit(role);
    const limit = parseLimit(filters.limit);
    const where = this.buildBusinessWhere(businessId, role, filters);
    const items = await this.prisma.auditLog.findMany({
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      where,
    });
    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, limit) : items;
    const last = pageItems.at(-1);

    return {
      hasMore,
      items: pageItems.map((item) => this.toResponse(item)),
      nextCursor: hasMore && last ? encodeCursor(last) : undefined,
    };
  }

  async findBusinessEventById(
    businessId: string,
    auditLogId: string,
    role: BusinessRole,
  ): Promise<AuditLogResponse> {
    this.assertRoleCanReadAudit(role);
    const visibleEventTypes = this.visibleEventTypesForRole(role);
    const item = await this.prisma.auditLog.findFirst({
      where: {
        businessId,
        eventType: { in: visibleEventTypes },
        id: auditLogId,
      },
    });

    if (!item) {
      throw new AuditLogNotFoundError();
    }

    return this.toResponse(item);
  }

  private buildBusinessWhere(
    businessId: string,
    role: BusinessRole,
    filters: AuditLogFilters,
  ): Prisma.AuditLogWhereInput {
    const visibleEventTypes = this.visibleEventTypesForRole(role);
    const where: Prisma.AuditLogWhereInput = {
      businessId,
      eventType: { in: visibleEventTypes },
    };

    if (filters.eventType) {
      if (!isKnownAuditEvent(filters.eventType)) {
        throw new AuditFilterInvalidError('Unknown audit event type.');
      }

      where.eventType = visibleEventTypes.includes(filters.eventType)
        ? filters.eventType
        : { in: [] };
    }

    if (filters.outcome) {
      if (!Object.values(AuditOutcome).includes(filters.outcome as AuditOutcome)) {
        throw new AuditFilterInvalidError('Unknown audit outcome.');
      }

      where.outcome = filters.outcome as AuditOutcome;
    }

    for (const [filterKey, columnKey] of [
      ['actorUserId', 'actorUserId'],
      ['entityType', 'entityType'],
      ['entityId', 'entityId'],
      ['correlationId', 'correlationId'],
      ['requestId', 'requestId'],
    ] as const) {
      const value = filters[filterKey];
      if (value) {
        where[columnKey] = value;
      }
    }

    const dateFilter = parseDateFilter(filters.dateFrom, filters.dateTo);
    if (dateFilter) {
      where.occurredAt = dateFilter;
    }

    if (filters.cursor) {
      const cursor = decodeCursor(filters.cursor);
      if (cursor.businessId !== businessId) {
        throw new AuditFilterInvalidError('Audit cursor is not valid for this business.');
      }

      const cursorDate = new Date(cursor.occurredAt);
      if (Number.isNaN(cursorDate.getTime())) {
        throw new AuditFilterInvalidError('Audit cursor is invalid.');
      }

      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { occurredAt: { lt: cursorDate } },
            { occurredAt: cursorDate, id: { lt: cursor.id } },
          ],
        },
      ];
    }

    return where;
  }

  private visibleEventTypesForRole(role: BusinessRole): string[] {
    const categories = readableAuditCategoriesForRole(role);
    return Object.entries(auditEventCatalog)
      .filter(([, definition]) => categories.includes(definition.category))
      .map(([eventType]) => eventType);
  }

  private assertRoleCanReadAudit(role: BusinessRole) {
    if (readableAuditCategoriesForRole(role).length === 0) {
      throw new AuditAccessDeniedError();
    }
  }

  private validateActorAndSource(input: CreateAuditEventInput) {
    if (input.actorType === AuditActorType.USER && !input.actorUserId) {
      throw new AuditEventInvalidError('User audit events require actorUserId.');
    }

    if (input.actorType !== AuditActorType.USER && input.actorUserId) {
      throw new AuditEventInvalidError('Only USER actor events may include actorUserId.');
    }

    if (
      (input.source === AuditSource.BACKGROUND_JOB || input.source === AuditSource.SYSTEM_RETRY) &&
      input.actorType !== AuditActorType.SYSTEM
    ) {
      throw new AuditEventInvalidError('Background audit sources require SYSTEM actor type.');
    }

    if (
      input.source === AuditSource.FUTURE_AI_TOOL &&
      input.actorType !== AuditActorType.FUTURE_AI_TOOL
    ) {
      throw new AuditEventInvalidError('AI audit sources require FUTURE_AI_TOOL actor type.');
    }
  }

  private async validateReferences(client: AuditPrismaClient, input: CreateAuditEventInput) {
    if (input.actorUserId) {
      const user = await client.user.findUnique({
        select: { id: true },
        where: { id: input.actorUserId },
      });
      if (!user) {
        throw new AuditEventInvalidError('Audit actor user was not found.');
      }
    }

    if (input.businessId) {
      const business = await client.business.findFirst({
        select: { id: true },
        where: { deletedAt: null, id: input.businessId },
      });
      if (!business) {
        throw new AuditEventInvalidError('Audit business was not found.');
      }
    }
  }

  private toResponse(item: AuditLog): AuditLogResponse {
    return {
      action: item.action,
      actorType: item.actorType,
      actorUserId: item.actorUserId ?? undefined,
      businessId: item.businessId ?? undefined,
      correlationId: item.correlationId ?? undefined,
      createdAt: item.createdAt.toISOString(),
      entityId: item.entityId ?? undefined,
      entityType: item.entityType ?? undefined,
      errorCode: item.errorCode ?? undefined,
      eventType: item.eventType,
      id: item.id,
      ipAddress: item.ipAddress ?? undefined,
      metadata: item.metadata ?? undefined,
      occurredAt: item.occurredAt.toISOString(),
      outcome: item.outcome,
      reason: item.reason ?? undefined,
      relatedEntityId: item.relatedEntityId ?? undefined,
      relatedEntityType: item.relatedEntityType ?? undefined,
      requestId: item.requestId ?? undefined,
      source: item.source,
      userAgent: item.userAgent ?? undefined,
    };
  }
}

function parseLimit(value: string | undefined): number {
  if (!value) {
    return defaultLimit;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AuditFilterInvalidError('Audit limit must be a positive integer.');
  }

  return Math.min(parsed, maxLimit);
}

function parseDateFilter(
  dateFrom: string | undefined,
  dateTo: string | undefined,
): Prisma.DateTimeFilter | undefined {
  if (!dateFrom && !dateTo) {
    return undefined;
  }

  const from = dateFrom ? new Date(dateFrom) : undefined;
  const to = dateTo ? new Date(dateTo) : undefined;

  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    throw new AuditFilterInvalidError('Audit date filter is invalid.');
  }

  if (from && to) {
    if (from > to) {
      throw new AuditFilterInvalidError('Audit date range must start before it ends.');
    }

    if (to.getTime() - from.getTime() > maxDateWindowMs) {
      throw new AuditFilterInvalidError('Audit date range cannot exceed 366 days.');
    }
  }

  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

function encodeCursor(item: AuditLog): string {
  const cursor: DecodedCursor = {
    businessId: item.businessId ?? '',
    id: item.id,
    occurredAt: item.occurredAt.toISOString(),
  };
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(value: string): DecodedCursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Partial<DecodedCursor>;
    if (!parsed.businessId || !parsed.id || !parsed.occurredAt) {
      throw new Error('Invalid cursor');
    }

    return {
      businessId: parsed.businessId,
      id: parsed.id,
      occurredAt: parsed.occurredAt,
    };
  } catch {
    throw new AuditFilterInvalidError('Audit cursor is invalid.');
  }
}
