import { describe, expect, it } from 'vitest';
import { fingerprintEmail, fingerprintIdempotencyKey } from './audit-fingerprint.util';
import { validateAndSanitizeAuditMetadata } from './audit-metadata.validator';
import { AuditMetadataRejectedError } from './audit-errors';
import { maskEmailAddress } from './audit-redaction.util';

const allowedKeys = ['transactionId', 'idempotencyKeyFingerprint', 'nested', 'items', 'createdAt'];

describe('audit metadata security utilities', () => {
  it('allows declared metadata keys and normalizes dates', () => {
    const result = validateAndSanitizeAuditMetadata(
      { createdAt: new Date('2026-07-12T07:00:00.000Z'), transactionId: 'txn_1' },
      allowedKeys,
    );

    expect(result).toEqual({ createdAt: '2026-07-12T07:00:00.000Z', transactionId: 'txn_1' });
  });

  it('rejects unknown top-level metadata keys', () => {
    expect(() => validateAndSanitizeAuditMetadata({ unknown: 'x' }, allowedKeys)).toThrow(
      AuditMetadataRejectedError,
    );
  });

  it.each([
    'password',
    'passwordHash',
    'accessToken',
    'refreshToken',
    'authorization',
    'cookie',
    'apiKey',
    'secret',
    'connectionString',
    'databaseUrl',
    'smtpPassword',
    'providerKey',
    'prompt',
    'chainOfThought',
    'stack',
    'rawRequest',
    'rawResponse',
  ])('rejects blocked secret key %s', (key) => {
    expect(() =>
      validateAndSanitizeAuditMetadata({ nested: { [key]: 'hidden' } }, allowedKeys),
    ).toThrow(AuditMetadataRejectedError);
  });

  it('rejects functions, class instances, buffers, raw Error objects, and Prisma-style errors', () => {
    class Dangerous {}

    expect(() =>
      validateAndSanitizeAuditMetadata({ nested: () => undefined }, allowedKeys),
    ).toThrow(AuditMetadataRejectedError);
    expect(() =>
      validateAndSanitizeAuditMetadata({ nested: new Dangerous() }, allowedKeys),
    ).toThrow(AuditMetadataRejectedError);
    expect(() =>
      validateAndSanitizeAuditMetadata({ nested: Buffer.from('x') }, allowedKeys),
    ).toThrow(AuditMetadataRejectedError);
    expect(() =>
      validateAndSanitizeAuditMetadata({ nested: new Error('nope') }, allowedKeys),
    ).toThrow(AuditMetadataRejectedError);
    expect(() =>
      validateAndSanitizeAuditMetadata(
        { nested: { clientVersion: '6.19.3', code: 'P2002', stack: 'secret stack' } },
        allowedKeys,
      ),
    ).toThrow(AuditMetadataRejectedError);
  });

  it('enforces depth, array, string, and serialized size limits', () => {
    expect(() =>
      validateAndSanitizeAuditMetadata(
        { nested: { a: { b: { c: { d: 'too deep' } } } } },
        allowedKeys,
      ),
    ).toThrow(AuditMetadataRejectedError);
    expect(() =>
      validateAndSanitizeAuditMetadata(
        { items: Array.from({ length: 51 }, (_, i) => i) },
        allowedKeys,
      ),
    ).toThrow(AuditMetadataRejectedError);
    expect(() =>
      validateAndSanitizeAuditMetadata({ transactionId: 'x'.repeat(501) }, allowedKeys),
    ).toThrow(AuditMetadataRejectedError);
    expect(() =>
      validateAndSanitizeAuditMetadata({ nested: { value: 'x'.repeat(8 * 1024) } }, allowedKeys),
    ).toThrow(AuditMetadataRejectedError);
  });

  it('omits undefined values and never stores raw idempotency keys', () => {
    const fingerprint = fingerprintIdempotencyKey('raw-key-value');
    const result = validateAndSanitizeAuditMetadata(
      { idempotencyKeyFingerprint: fingerprint, transactionId: undefined },
      allowedKeys,
    );

    expect(result).toEqual({ idempotencyKeyFingerprint: fingerprint });
    expect(() =>
      validateAndSanitizeAuditMetadata({ idempotencyKey: 'raw-key-value' }, allowedKeys),
    ).toThrow(AuditMetadataRejectedError);
  });

  it('masks email addresses and fingerprints attempted emails stably', () => {
    expect(maskEmailAddress('Ahmed.Example@Email.com')).toBe('ah***@email.com');
    expect(fingerprintEmail('USER@example.com')).toBe(fingerprintEmail(' user@example.com '));
    expect(fingerprintEmail('USER@example.com')).not.toBe('user@example.com');
  });
});
