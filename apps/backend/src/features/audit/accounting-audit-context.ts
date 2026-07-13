import { AuditSource } from '@prisma/client';

export interface AccountingAuditContext {
  actorUserId: string;
  correlationId?: string;
  ipAddress?: string;
  requestId?: string;
  transportSource: 'API' | 'MOBILE';
  userAgent?: string;
}

export type AccountingOperationSource = 'IMPORT' | 'MANUAL' | 'SYSTEM_RETRY';

export function mapAccountingAuditSource(
  operationSource: AccountingOperationSource | undefined,
  context: Pick<AccountingAuditContext, 'transportSource'>,
): AuditSource {
  if (operationSource === 'SYSTEM_RETRY') {
    return AuditSource.SYSTEM_RETRY;
  }

  if (operationSource === 'IMPORT') {
    return AuditSource.IMPORT;
  }

  return context.transportSource === 'MOBILE' ? AuditSource.MOBILE : AuditSource.API;
}

export function buildAccountingAuditContext(input: {
  actorUserId: string;
  correlationId?: string;
  ipAddress?: string;
  requestId?: string;
  transportSource?: 'API' | 'MOBILE';
  userAgent?: string;
}): AccountingAuditContext {
  return {
    actorUserId: input.actorUserId,
    correlationId: input.correlationId,
    ipAddress: input.ipAddress,
    requestId: input.requestId,
    transportSource: input.transportSource ?? 'API',
    userAgent: input.userAgent,
  };
}
