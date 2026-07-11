import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  JournalEntryStatus,
  Prisma,
  type Account,
  type JournalEntry,
  type JournalLine,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CreateJournalDraftDto } from './dto/create-journal-draft.dto';
import {
  calculateJournalTotals,
  validateJournalLinesBalanced,
  type JournalTotals,
} from './validators/journal-balancing';

type JournalLineWithAccount = JournalLine & {
  account: Account;
};

type JournalEntryWithLines = JournalEntry & {
  lines: JournalLineWithAccount[];
};

export interface JournalLineResponse {
  accountId: string;
  creditAmount: string;
  createdAt: string;
  debitAmount: string;
  description?: string;
  id: string;
  journalEntryId: string;
  updatedAt: string;
}

export interface JournalEntryResponse {
  businessId: string;
  createdAt: string;
  createdById: string;
  description: string;
  id: string;
  idempotencyKey: string;
  lineCount: number;
  lines: JournalLineResponse[];
  postedAt?: string;
  postingDate: string;
  sourceTransactionId?: string;
  status: JournalEntry['status'];
  totals: JournalTotals;
  updatedAt: string;
  voidedAt?: string;
  voidedById?: string;
}

@Injectable()
export class JournalsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    businessId: string,
    filters: { sourceTransactionId?: string; status?: string },
  ): Promise<JournalEntryResponse[]> {
    const status = this.parseJournalStatus(filters.status);
    const entries = await this.prisma.journalEntry.findMany({
      include: {
        lines: {
          include: { account: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { postingDate: 'desc' },
      where: {
        businessId,
        deletedAt: null,
        sourceTransactionId: filters.sourceTransactionId,
        status,
      },
    });

    return entries.map((entry) => this.toResponse(entry));
  }

  async getById(businessId: string, journalEntryId: string): Promise<JournalEntryResponse> {
    const entry = await this.findEntryForBusiness(businessId, journalEntryId);

    this.verifyLoadedLineAccountsBelongToBusiness(businessId, entry.lines);

    return this.toResponse(entry);
  }

  async createDraft(
    businessId: string,
    createdById: string,
    dto: CreateJournalDraftDto,
  ): Promise<JournalEntryResponse> {
    const status = dto.status ?? JournalEntryStatus.DRAFT;

    if (status !== JournalEntryStatus.DRAFT && status !== JournalEntryStatus.PENDING) {
      throw new BadRequestException('Draft journal entries can only use DRAFT or PENDING status.');
    }

    validateJournalLinesBalanced(dto.lines);
    await this.validateJournalAccountsBelongToBusiness(
      businessId,
      dto.lines.map((line) => line.accountId),
    );
    await this.verifySourceTransactionBelongsToBusiness(businessId, dto.sourceTransactionId);

    try {
      const entry = await this.prisma.journalEntry.create({
        data: {
          businessId,
          createdById,
          description: dto.description.trim(),
          idempotencyKey: dto.idempotencyKey.trim(),
          lines: {
            create: dto.lines.map((line) => ({
              accountId: line.accountId,
              creditAmount: line.creditAmount ?? 0,
              debitAmount: line.debitAmount ?? 0,
              description: line.description?.trim() || undefined,
            })),
          },
          postingDate: new Date(dto.postingDate),
          sourceTransactionId: dto.sourceTransactionId,
          status,
        },
        include: {
          lines: {
            include: { account: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return this.toResponse(entry);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async validateJournalAccountsBelongToBusiness(
    businessId: string,
    accountIds: string[],
  ): Promise<void> {
    const uniqueAccountIds = [...new Set(accountIds)];
    const accounts = await this.prisma.account.findMany({
      select: { id: true },
      where: {
        businessId,
        deletedAt: null,
        id: { in: uniqueAccountIds },
        isActive: true,
      },
    });

    if (accounts.length !== uniqueAccountIds.length) {
      throw new NotFoundException('Active account not found for this business.');
    }
  }

  private async findEntryForBusiness(
    businessId: string,
    journalEntryId: string,
  ): Promise<JournalEntryWithLines> {
    const entry = await this.prisma.journalEntry.findFirst({
      include: {
        lines: {
          include: { account: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      where: {
        businessId,
        deletedAt: null,
        id: journalEntryId,
      },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found.');
    }

    return entry;
  }

  private verifyLoadedLineAccountsBelongToBusiness(
    businessId: string,
    lines: JournalLineWithAccount[],
  ) {
    const invalidLine = lines.find(
      (line) => line.account.businessId !== businessId || Boolean(line.account.deletedAt),
    );

    if (invalidLine) {
      throw new NotFoundException('Journal entry line account not found for this business.');
    }
  }

  private async verifySourceTransactionBelongsToBusiness(
    businessId: string,
    sourceTransactionId?: string,
  ) {
    if (!sourceTransactionId) {
      return;
    }

    const transaction = await this.prisma.transaction.findFirst({
      select: { id: true },
      where: {
        businessId,
        deletedAt: null,
        id: sourceTransactionId,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Source transaction not found for this business.');
    }
  }

  private parseJournalStatus(status?: string): JournalEntryStatus | undefined {
    if (!status) {
      return undefined;
    }

    if (!Object.values(JournalEntryStatus).includes(status as JournalEntryStatus)) {
      throw new BadRequestException('Unknown journal entry status.');
    }

    return status as JournalEntryStatus;
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Journal entry idempotency key already exists.');
    }

    throw error;
  }

  private toResponse(entry: JournalEntryWithLines): JournalEntryResponse {
    return {
      businessId: entry.businessId,
      createdAt: entry.createdAt.toISOString(),
      createdById: entry.createdById,
      description: entry.description,
      id: entry.id,
      idempotencyKey: entry.idempotencyKey,
      lineCount: entry.lines.length,
      lines: entry.lines.map((line) => ({
        accountId: line.accountId,
        createdAt: line.createdAt.toISOString(),
        creditAmount: line.creditAmount.toString(),
        debitAmount: line.debitAmount.toString(),
        description: line.description ?? undefined,
        id: line.id,
        journalEntryId: line.journalEntryId,
        updatedAt: line.updatedAt.toISOString(),
      })),
      postedAt: entry.postedAt?.toISOString(),
      postingDate: entry.postingDate.toISOString(),
      sourceTransactionId: entry.sourceTransactionId ?? undefined,
      status: entry.status,
      totals: calculateJournalTotals(entry.lines),
      updatedAt: entry.updatedAt.toISOString(),
      voidedAt: entry.voidedAt?.toISOString(),
      voidedById: entry.voidedById ?? undefined,
    };
  }
}
