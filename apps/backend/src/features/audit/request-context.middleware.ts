import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import { truncateForAudit } from '../audit/audit-redaction.util';

const safeCorrelationIdPattern = /^[A-Za-z0-9._:-]{1,100}$/;

export interface BackendRequestContext {
  correlationId: string;
  ipAddress?: string;
  requestId: string;
  source: 'API';
  userAgent?: string;
}

export interface RequestWithAuditContext {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  requestContext?: BackendRequestContext;
  socket?: { remoteAddress?: string };
}

interface ResponseWithHeaders {
  setHeader(name: string, value: string): void;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: RequestWithAuditContext, res: ResponseWithHeaders, next: () => void) {
    const requestId = randomUUID();
    const correlationId = resolveCorrelationId(req.headers?.['x-correlation-id']);
    const userAgent = readHeader(req.headers?.['user-agent']);
    const ipAddress = truncateForAudit(req.ip ?? req.socket?.remoteAddress, 64);

    req.requestContext = {
      correlationId,
      ipAddress,
      requestId,
      source: 'API',
      userAgent: truncateForAudit(userAgent, 512),
    };

    res.setHeader('x-request-id', requestId);
    res.setHeader('x-correlation-id', correlationId);
    next();
  }
}

export function resolveCorrelationId(value: string | string[] | undefined): string {
  const candidate = readHeader(value)?.trim();

  if (candidate && safeCorrelationIdPattern.test(candidate)) {
    return candidate;
  }

  return randomUUID();
}

export function readHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}
