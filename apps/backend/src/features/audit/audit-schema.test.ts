import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(join(process.cwd(), 'apps/backend/prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  join(
    process.cwd(),
    'apps/backend/prisma/migrations/20260712073747_add_audit_log_foundation/migration.sql',
  ),
  'utf8',
);

describe('AuditLog Prisma schema foundation', () => {
  it('defines audit enums and the AuditLog model', () => {
    expect(schema).toContain('enum AuditActorType');
    expect(schema).toContain('enum AuditOutcome');
    expect(schema).toContain('enum AuditSource');
    expect(schema).toContain('model AuditLog');
  });

  it('keeps businessId nullable at the schema level for approved global events', () => {
    expect(schema).toContain('businessId        String?');
    expect(schema).toContain('actorUserId       String?');
  });

  it('does not define updatedAt or soft-delete fields on AuditLog', () => {
    const auditModel = schema.slice(schema.indexOf('model AuditLog'));
    expect(auditModel).not.toContain('updatedAt');
    expect(auditModel).not.toContain('deletedAt');
  });

  it('defines required AuditLog indexes', () => {
    expect(schema).toContain('@@index([businessId, occurredAt])');
    expect(schema).toContain('@@index([businessId, eventType, occurredAt])');
    expect(schema).toContain('@@index([businessId, entityType, entityId])');
    expect(schema).toContain('@@index([businessId, actorUserId, occurredAt])');
    expect(schema).toContain('@@index([correlationId])');
    expect(schema).toContain('@@index([requestId])');
  });

  it('uses restrict delete relations so audit evidence is not cascade-deleted', () => {
    expect(schema).toContain('references: [id], onDelete: Restrict');
    expect(migration).toContain('ON DELETE RESTRICT ON UPDATE CASCADE');
  });

  it('migration creates only audit-specific tables, enums, indexes, and foreign keys', () => {
    expect(migration).toContain('CREATE TABLE "AuditLog"');
    expect(migration).not.toContain('ALTER TABLE "JournalEntry"');
    expect(migration).not.toContain('ALTER TABLE "JournalLine"');
    expect(migration).not.toContain('ALTER TABLE "Transaction"');
  });
});
