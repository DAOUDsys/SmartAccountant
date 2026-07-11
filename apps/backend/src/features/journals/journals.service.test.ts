import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AccountType, JournalEntryStatus, NormalBalance, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { JournalsService } from './journals.service';

const now = new Date('2026-07-11T00:00:00.000Z');
const cashAccount = {
  businessId: 'business_1',
  code: '1000',
  createdAt: now,
  deletedAt: null,
  description: null,
  id: 'cash_account',
  isActive: true,
  isSystem: true,
  name: 'Cash',
  normalBalance: NormalBalance.DEBIT,
  parentId: null,
  type: AccountType.ASSET,
  updatedAt: now,
};
const equityAccount = {
  ...cashAccount,
  code: '3000',
  id: 'equity_account',
  name: 'Owner Equity',
  normalBalance: NormalBalance.CREDIT,
  type: AccountType.EQUITY,
};
const journalEntry = {
  businessId: 'business_1',
  createdAt: now,
  createdById: 'user_1',
  deletedAt: null,
  description: 'Opening balance draft',
  id: 'journal_1',
  idempotencyKey: 'journal-draft-1',
  lines: [
    {
      account: cashAccount,
      accountId: cashAccount.id,
      createdAt: now,
      creditAmount: new Prisma.Decimal(0),
      debitAmount: new Prisma.Decimal(200),
      description: null,
      id: 'line_1',
      journalEntryId: 'journal_1',
      updatedAt: now,
    },
    {
      account: equityAccount,
      accountId: equityAccount.id,
      createdAt: now,
      creditAmount: new Prisma.Decimal(200),
      debitAmount: new Prisma.Decimal(0),
      description: null,
      id: 'line_2',
      journalEntryId: 'journal_1',
      updatedAt: now,
    },
  ],
  postedAt: null,
  postingDate: now,
  sourceTransactionId: null,
  status: JournalEntryStatus.DRAFT,
  updatedAt: now,
  voidedAt: null,
  voidedById: null,
};

function createService(prisma: unknown) {
  return new JournalsService(prisma as never);
}

describe('JournalsService', () => {
  it('lists only current-business journal entries with filters', async () => {
    const prisma = {
      journalEntry: {
        findMany: vi.fn().mockResolvedValue([journalEntry]),
      },
    };
    const service = createService(prisma);

    const result = await service.list('business_1', {
      sourceTransactionId: 'transaction_1',
      status: JournalEntryStatus.DRAFT,
    });

    expect(prisma.journalEntry.findMany).toHaveBeenCalledWith({
      include: {
        lines: {
          include: { account: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { postingDate: 'desc' },
      where: {
        businessId: 'business_1',
        deletedAt: null,
        sourceTransactionId: 'transaction_1',
        status: JournalEntryStatus.DRAFT,
      },
    });
    expect(result[0]).toMatchObject({
      businessId: 'business_1',
      id: 'journal_1',
      lineCount: 2,
      status: JournalEntryStatus.DRAFT,
      totals: {
        isBalanced: true,
        totalCredit: '200.00',
        totalDebit: '200.00',
      },
    });
  });

  it('rejects unknown journal status filters', async () => {
    const service = createService({});

    await expect(service.list('business_1', { status: 'UNKNOWN' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('fails cross-tenant journal entry id guessing safely', async () => {
    const prisma = {
      journalEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(service.getById('business_1', 'journal_from_business_2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.journalEntry.findFirst).toHaveBeenCalledWith({
      include: {
        lines: {
          include: { account: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      where: {
        businessId: 'business_1',
        deletedAt: null,
        id: 'journal_from_business_2',
      },
    });
  });

  it('rejects detail when a loaded journal line account is outside the business', async () => {
    const prisma = {
      journalEntry: {
        findFirst: vi.fn().mockResolvedValue({
          ...journalEntry,
          lines: [
            journalEntry.lines[0],
            {
              ...journalEntry.lines[1],
              account: { ...equityAccount, businessId: 'business_2' },
            },
          ],
        }),
      },
    };
    const service = createService(prisma);

    await expect(service.getById('business_1', 'journal_1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('validates draft accounts belong to the business and are active', async () => {
    const prisma = {
      account: {
        findMany: vi.fn().mockResolvedValue([{ id: cashAccount.id }]),
      },
    };
    const service = createService(prisma);

    await expect(
      service.validateJournalAccountsBelongToBusiness('business_1', [
        cashAccount.id,
        'other_business_account',
      ]),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.account.findMany).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        businessId: 'business_1',
        deletedAt: null,
        id: { in: [cashAccount.id, 'other_business_account'] },
        isActive: true,
      },
    });
  });

  it('creates balanced draft entries without posting transactions', async () => {
    const prisma = {
      account: {
        findMany: vi.fn().mockResolvedValue([{ id: cashAccount.id }, { id: equityAccount.id }]),
      },
      journalEntry: {
        create: vi.fn().mockResolvedValue(journalEntry),
      },
      transaction: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    };
    const service = createService(prisma);

    const result = await service.createDraft('business_1', 'user_1', {
      description: 'Opening balance draft',
      idempotencyKey: 'journal-draft-1',
      lines: [
        { accountId: cashAccount.id, debitAmount: 200 },
        { accountId: equityAccount.id, creditAmount: 200 },
      ],
      postingDate: now.toISOString(),
      status: JournalEntryStatus.DRAFT,
    });

    expect(prisma.journalEntry.create).toHaveBeenCalledWith({
      data: {
        businessId: 'business_1',
        createdById: 'user_1',
        description: 'Opening balance draft',
        idempotencyKey: 'journal-draft-1',
        lines: {
          create: [
            {
              accountId: cashAccount.id,
              creditAmount: 0,
              debitAmount: 200,
              description: undefined,
            },
            {
              accountId: equityAccount.id,
              creditAmount: 200,
              debitAmount: 0,
              description: undefined,
            },
          ],
        },
        postingDate: now,
        sourceTransactionId: undefined,
        status: JournalEntryStatus.DRAFT,
      },
      include: {
        lines: {
          include: { account: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    expect(prisma.transaction.update).not.toHaveBeenCalled();
    expect(result.status).toBe(JournalEntryStatus.DRAFT);
  });

  it('rejects unbalanced draft entries', async () => {
    const service = createService({});

    await expect(
      service.createDraft('business_1', 'user_1', {
        description: 'Bad draft',
        idempotencyKey: 'bad-draft',
        lines: [
          { accountId: cashAccount.id, debitAmount: 200 },
          { accountId: equityAccount.id, creditAmount: 199 },
        ],
        postingDate: now.toISOString(),
        status: JournalEntryStatus.DRAFT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects posted status on draft creation', async () => {
    const service = createService({});

    await expect(
      service.createDraft('business_1', 'user_1', {
        description: 'Unsafe posted draft',
        idempotencyKey: 'posted-draft',
        lines: [
          { accountId: cashAccount.id, debitAmount: 200 },
          { accountId: equityAccount.id, creditAmount: 200 },
        ],
        postingDate: now.toISOString(),
        status: JournalEntryStatus.POSTED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns duplicate idempotency keys as conflicts', async () => {
    const prisma = {
      account: {
        findMany: vi.fn().mockResolvedValue([{ id: cashAccount.id }, { id: equityAccount.id }]),
      },
      journalEntry: {
        create: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            clientVersion: '6.19.3',
            code: 'P2002',
          }),
        ),
      },
    };
    const service = createService(prisma);

    await expect(
      service.createDraft('business_1', 'user_1', {
        description: 'Duplicate draft',
        idempotencyKey: 'journal-draft-1',
        lines: [
          { accountId: cashAccount.id, debitAmount: 200 },
          { accountId: equityAccount.id, creditAmount: 200 },
        ],
        postingDate: now.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
