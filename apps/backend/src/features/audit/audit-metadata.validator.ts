import type { Prisma } from '@prisma/client';
import { AuditMetadataRejectedError } from './audit-errors';

const maxDepth = 3;
const maxArrayLength = 50;
const maxStringLength = 500;
const maxSerializedBytes = 8 * 1024;

const blockedNormalizedKeys = new Set([
  'apikey',
  'accesstoken',
  'authorization',
  'chainofthought',
  'connectionstring',
  'cookie',
  'databaseurl',
  'idempotencykey',
  'password',
  'passwordhash',
  'privatekey',
  'prompt',
  'providerkey',
  'rawrequest',
  'rawresponse',
  'refreshtoken',
  'secret',
  'smtppassword',
  'stack',
  'token',
]);

export type AuditMetadataInput = Record<string, unknown>;

export function validateAndSanitizeAuditMetadata(
  metadata: AuditMetadataInput | undefined,
  allowedKeys: readonly string[],
): Prisma.InputJsonObject | undefined {
  if (metadata === undefined) {
    return undefined;
  }

  assertPlainObject(metadata, 'metadata');
  const allowedKeySet = new Set(allowedKeys);
  const sanitized = sanitizeObject(metadata, allowedKeySet, 0, 'metadata');
  const serialized = JSON.stringify(sanitized);

  if (Buffer.byteLength(serialized, 'utf8') > maxSerializedBytes) {
    throw new AuditMetadataRejectedError('Audit metadata exceeds the 8 KB limit.');
  }

  return sanitized as Prisma.InputJsonObject;
}

export function assertSafeAuditMetadataKey(key: string) {
  const normalized = normalizeKey(key);

  if (!normalized || blockedNormalizedKeys.has(normalized)) {
    throw new AuditMetadataRejectedError('Audit metadata contains a blocked key.');
  }
}

function sanitizeObject(
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
  depth: number,
  path: string,
): Prisma.InputJsonObject {
  if (depth > maxDepth) {
    throw new AuditMetadataRejectedError('Audit metadata exceeds the maximum nesting depth.');
  }

  const sanitized: Record<string, Prisma.JsonValue> = {};

  for (const [key, item] of Object.entries(value)) {
    assertSafeAuditMetadataKey(key);

    if (depth === 0 && !allowedKeys.has(key)) {
      throw new AuditMetadataRejectedError(
        `Audit metadata key "${key}" is not allowed for this event.`,
      );
    }

    if (item === undefined) {
      continue;
    }

    sanitized[key] = sanitizeValue(item, allowedKeys, depth + 1, `${path}.${key}`);
  }

  return sanitized as Prisma.InputJsonObject;
}

function sanitizeValue(
  value: unknown,
  allowedKeys: Set<string>,
  depth: number,
  path: string,
): Prisma.JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new AuditMetadataRejectedError(`Audit metadata value at ${path} is not finite.`);
    }

    return value as Prisma.JsonValue;
  }

  if (typeof value === 'string') {
    if (value.length > maxStringLength) {
      throw new AuditMetadataRejectedError(
        `Audit metadata string at ${path} exceeds 500 characters.`,
      );
    }

    return value as Prisma.JsonValue;
  }

  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
    throw new AuditMetadataRejectedError(`Audit metadata value at ${path} is unsupported.`);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error || Buffer.isBuffer(value)) {
    throw new AuditMetadataRejectedError(`Audit metadata value at ${path} is unsafe.`);
  }

  if (Array.isArray(value)) {
    if (value.length > maxArrayLength) {
      throw new AuditMetadataRejectedError('Audit metadata arrays are limited to 50 entries.');
    }

    return value
      .filter((item) => item !== undefined)
      .map((item, index) => sanitizeValue(item, allowedKeys, depth + 1, `${path}[${index}]`));
  }

  assertPlainObject(value, path);
  return sanitizeObject(value, allowedKeys, depth, path) as unknown as Prisma.JsonValue;
}

function assertPlainObject(value: unknown, path: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new AuditMetadataRejectedError(`Audit metadata at ${path} must be a plain object.`);
  }

  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) {
    throw new AuditMetadataRejectedError(`Audit metadata at ${path} must be a plain object.`);
  }
}

function normalizeKey(key: string): string {
  return key
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}
