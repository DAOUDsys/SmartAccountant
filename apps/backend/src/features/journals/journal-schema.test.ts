import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(join(process.cwd(), 'apps/backend/prisma/schema.prisma'), 'utf8');

describe('journal Prisma schema foundation', () => {
  it('defines JournalEntry as tenant scoped', () => {
    expect(schema).toContain('model JournalEntry');
    expect(schema).toContain('businessId          String');
    expect(schema).toContain('@@index([businessId])');
    expect(schema).toContain('@@index([businessId, status])');
    expect(schema).toContain('@@unique([businessId, idempotencyKey])');
  });

  it('defines JournalLine with an Account relation', () => {
    expect(schema).toContain('model JournalLine');
    expect(schema).toContain('accountId      String');
    expect(schema).toContain('account        Account');
    expect(schema).toContain('@@index([journalEntryId])');
    expect(schema).toContain('@@index([accountId])');
  });
});
