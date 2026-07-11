import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransactionStatus, TransactionType, type Account, type Transaction } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  adjustmentIssue,
  validateAdjustmentHeader,
  validateAdjustmentLines,
} from './adjustment-line.validators';
import { buildAdjustmentPreview } from './adjustment-preview.builder';
import type {
  AdjustmentLineResponse,
  AdjustmentLineWithAccount,
  AdjustmentPreviewResponse,
} from './adjustment-preview.types';
import type { ReplaceAdjustmentLinesDto } from './dto/replace-adjustment-lines.dto';

type AdjustmentTransaction = Transaction;

@Injectable()
export class AdjustmentsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listLines(businessId: string, transactionId: string): Promise<AdjustmentLineResponse[]> {
    await this.findAdjustmentTransaction(businessId, transactionId, false);
    const lines = await this.prisma.transactionAdjustmentLine.findMany({
      include: { account: true },
      orderBy: { createdAt: 'asc' },
      where: {
        businessId,
        transactionId,
      },
    });

    return lines.map((line) => this.toLineResponse(line));
  }

  async replaceLines(
    businessId: string,
    transactionId: string,
    dto: ReplaceAdjustmentLinesDto,
  ): Promise<AdjustmentLineResponse[]> {
    const transaction = await this.findAdjustmentTransaction(businessId, transactionId, true);
    const headerErrors = validateAdjustmentHeader({
      description: dto.description,
      reason: dto.reason,
    });

    if (headerErrors.length > 0) {
      throw new BadRequestException({
        errors: headerErrors,
        message: 'Adjustment header is invalid.',
      });
    }

    const accounts = await this.loadAccountsForLines(
      businessId,
      dto.lines.map((line) => line.accountId),
    );
    const validated = validateAdjustmentLines(businessId, dto.lines, accounts);

    const lines = await this.prisma.$transaction(async (tx) => {
      await tx.transactionAdjustmentLine.deleteMany({
        where: {
          businessId,
          transactionId,
        },
      });

      await tx.transaction.update({
        data: {
          adjustmentReason: dto.reason.trim(),
          description: dto.description.trim(),
          transactionDate: new Date(dto.postingDate),
        },
        where: { id: transaction.id },
      });

      await tx.transactionAdjustmentLine.createMany({
        data: validated.lines.map((line) => ({
          accountId: line.accountId,
          businessId,
          creditAmount: line.creditAmount,
          debitAmount: line.debitAmount,
          description: line.description,
          transactionId,
        })),
      });

      return tx.transactionAdjustmentLine.findMany({
        include: { account: true },
        orderBy: { createdAt: 'asc' },
        where: {
          businessId,
          transactionId,
        },
      });
    });

    return lines.map((line) => this.toLineResponse(line));
  }

  async preview(businessId: string, transactionId: string): Promise<AdjustmentPreviewResponse> {
    const transaction = await this.findAdjustmentTransaction(businessId, transactionId, true);
    const lines = await this.prisma.transactionAdjustmentLine.findMany({
      include: { account: true },
      orderBy: { createdAt: 'asc' },
      where: {
        businessId,
        transactionId,
      },
    });

    const headerErrors = validateAdjustmentHeader({
      description: transaction.description,
      reason: transaction.adjustmentReason,
    });
    if (headerErrors.length > 0) {
      throw new BadRequestException({
        errors: headerErrors,
        message: 'Adjustment header is invalid.',
      });
    }

    validateAdjustmentLines(
      businessId,
      lines.map((line) => ({
        accountId: line.accountId,
        creditAmount: line.creditAmount.toFixed(2),
        debitAmount: line.debitAmount.toFixed(2),
        description: line.description ?? undefined,
      })),
      lines.map((line) => line.account),
    );

    const builtPreview = buildAdjustmentPreview(lines);

    return {
      businessId,
      canPost: true,
      currency: transaction.currency,
      errors: [],
      isBalanced: builtPreview.totalCredit === builtPreview.totalDebit,
      lines: builtPreview.lines,
      postingDate: transaction.transactionDate.toISOString(),
      totalCredit: builtPreview.totalCredit,
      totalDebit: builtPreview.totalDebit,
      transactionId: transaction.id,
      transactionStatus: transaction.status,
      transactionType: TransactionType.ADJUSTMENT,
      warnings: builtPreview.warnings,
    };
  }

  private async findAdjustmentTransaction(
    businessId: string,
    transactionId: string,
    requireDraft: boolean,
  ): Promise<AdjustmentTransaction> {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        businessId,
        deletedAt: null,
        id: transactionId,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found.');
    }

    if (transaction.type !== TransactionType.ADJUSTMENT) {
      throw new BadRequestException({
        errors: [
          adjustmentIssue(
            'TRANSACTION_NOT_ADJUSTMENT',
            'Adjustment lines are only available for ADJUSTMENT transactions.',
            'type',
          ),
        ],
        message: 'Transaction is not an adjustment.',
      });
    }

    if (requireDraft && transaction.status !== TransactionStatus.DRAFT) {
      throw new ConflictException({
        errors: [
          adjustmentIssue(
            'TRANSACTION_NOT_DRAFT',
            'Only DRAFT adjustment transactions can be modified or previewed.',
            'status',
          ),
        ],
        message: 'Only DRAFT adjustment transactions can be modified or previewed.',
      });
    }

    return transaction;
  }

  private async loadAccountsForLines(businessId: string, accountIds: string[]): Promise<Account[]> {
    const uniqueAccountIds = [...new Set(accountIds)];

    if (uniqueAccountIds.length === 0) {
      return [];
    }

    return this.prisma.account.findMany({
      where: {
        businessId,
        id: { in: uniqueAccountIds },
      },
    });
  }

  private toLineResponse(line: AdjustmentLineWithAccount): AdjustmentLineResponse {
    return {
      accountCode: line.account.code,
      accountId: line.accountId,
      accountName: line.account.name,
      accountType: line.account.type,
      businessId: line.businessId,
      creditAmount: line.creditAmount.toFixed(2),
      debitAmount: line.debitAmount.toFixed(2),
      description: line.description ?? undefined,
      id: line.id,
      transactionId: line.transactionId,
    };
  }
}
