import { createHash } from 'node:crypto';

export function fingerprintValue(value: string, length = 16): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, length);
}

export function fingerprintEmail(email: string): string {
  return fingerprintValue(email.trim().toLowerCase());
}

export function fingerprintIdempotencyKey(idempotencyKey: string): string {
  return fingerprintValue(idempotencyKey);
}
