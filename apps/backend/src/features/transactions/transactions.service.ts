import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TransactionStatus, type Transaction, type TransactionLine } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { reversalConflict } from '../reversals/reversal.errors';
import type { CreateTransactionDto } from './dto/create-transaction.dto';
import type { TransactionLineDto } from './dto/transaction-line.dto';
import type { UpdateTransactionDto } from './dto/update-transaction.dto';

type TransactionWithLines = Transaction & {
  lines: TransactionLine[];
};

export interface TransactionLineResponse {
  businessId: string;
  createdAt: string;
  description: string;
  id: string;
  productId?: string;
  quantity: string;
  totalAmount: string;
  transactionId: string;
  unitPrice: string;
  updatedAt: string;
}

export interface TransactionResponse {
  adjustmentReason?: string;
  businessId: string;
  createdAt: string;
  createdById: string;
  currency: string;
  customerId?: string;
  description?: string;
  id: string;
  lines: TransactionLineResponse[];
  status: Transaction['status'];
  supplierId?: string;
  totalAmount: string;
  transactionDate: string;
  type: Transaction['type'];
  updatedAt: string;
}

@Injectable()
export class TransactionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(businessId: string): Promise<TransactionResponse[]> {
    const transactions = await this.prisma.transaction.findMany({
      include: { lines: true },
      orderBy: { transactionDate: 'desc' },
      where: {
        businessId,
        deletedAt: null,
      },
    });

    return transactions.map((transaction) => this.toResponse(transaction));
  }

  async getById(businessId: string, transactionId: string): Promise<TransactionResponse> {
    const transaction = await this.findActiveTransaction(businessId, transactionId);

    return this.toResponse(transaction);
  }

  async create(
    businessId: string,
    createdById: string,
    dto: CreateTransactionDto,
  ): Promise<TransactionResponse> {
    await this.verifyRelatedRecords(businessId, dto);

    const transaction = await this.prisma.transaction.create({
      data: {
        businessId,
        adjustmentReason: dto.adjustmentReason?.trim() || undefined,
        createdById,
        currency: dto.currency.trim().toUpperCase(),
        customerId: dto.customerId,
        description: dto.description?.trim() || undefined,
        lines: {
          create: this.toLineCreates(businessId, dto.lines ?? []),
        },
        status: dto.status ?? TransactionStatus.DRAFT,
        supplierId: dto.supplierId,
        totalAmount: dto.totalAmount,
        transactionDate: new Date(dto.transactionDate),
        type: dto.type,
      },
      include: { lines: true },
    });

    return this.toResponse(transaction);
  }

  async update(
    businessId: string,
    transactionId: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionResponse> {
    const existing = await this.findActiveTransaction(businessId, transactionId);

    if (existing.status !== TransactionStatus.DRAFT) {
      throw new ConflictException('Only draft transactions can be updated.');
    }

    await this.verifyRelatedRecords(businessId, dto);

    const transaction = await this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.transactionLine.deleteMany({
          where: {
            businessId,
            transactionId,
          },
        });
      }

      return tx.transaction.update({
        data: {
          currency: dto.currency?.trim().toUpperCase(),
          adjustmentReason: dto.adjustmentReason?.trim(),
          customerId: dto.customerId,
          description: dto.description?.trim(),
          lines: dto.lines
            ? {
                create: this.toLineCreates(businessId, dto.lines),
              }
            : undefined,
          status: dto.status,
          supplierId: dto.supplierId,
          totalAmount: dto.totalAmount,
          transactionDate: dto.transactionDate ? new Date(dto.transactionDate) : undefined,
          type: dto.type,
        },
        include: { lines: true },
        where: { id: transactionId },
      });
    });

    return this.toResponse(transaction);
  }

  async voidTransaction(businessId: string, transactionId: string): Promise<TransactionResponse> {
    const existing = await this.findActiveTransaction(businessId, transactionId);

    if (existing.status === TransactionStatus.POSTED) {
      throw reversalConflict(
        'POSTED_TRANSACTION_REQUIRES_REVERSAL',
        'POSTED transactions require the reversal workflow and cannot be directly voided.',
      );
    }

    if (existing.status === TransactionStatus.VOIDED) {
      throw reversalConflict('TRANSACTION_ALREADY_VOIDED', 'Transaction is already VOIDED.');
    }

    const transaction = await this.prisma.transaction.update({
      data: { status: TransactionStatus.VOIDED },
      include: { lines: true },
      where: { id: transactionId },
    });

    return this.toResponse(transaction);
  }

  async findActiveTransaction(
    businessId: string,
    transactionId: string,
  ): Promise<TransactionWithLines> {
    const transaction = await this.prisma.transaction.findFirst({
      include: { lines: true },
      where: {
        businessId,
        deletedAt: null,
        id: transactionId,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found.');
    }

    return transaction;
  }

  private async verifyRelatedRecords(
    businessId: string,
    dto: Pick<CreateTransactionDto, 'customerId' | 'supplierId' | 'lines'>,
  ) {
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: {
          businessId,
          deletedAt: null,
          id: dto.customerId,
        },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found for this business.');
      }
    }

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: {
          businessId,
          deletedAt: null,
          id: dto.supplierId,
        },
      });

      if (!supplier) {
        throw new NotFoundException('Supplier not found for this business.');
      }
    }

    const productIds = [
      ...new Set((dto.lines ?? []).map((line) => line.productId).filter(Boolean)),
    ];

    if (productIds.length > 0) {
      const products = await this.prisma.product.findMany({
        select: { id: true },
        where: {
          businessId,
          deletedAt: null,
          id: {
            in: productIds as string[],
          },
        },
      });

      if (products.length !== productIds.length) {
        throw new NotFoundException('Product not found for this business.');
      }
    }
  }

  private toLineCreates(businessId: string, lines: TransactionLineDto[]) {
    return lines.map((line) => ({
      businessId,
      description: line.description.trim(),
      productId: line.productId,
      quantity: line.quantity,
      totalAmount: line.totalAmount,
      unitPrice: line.unitPrice,
    }));
  }

  private toResponse(transaction: TransactionWithLines): TransactionResponse {
    return {
      businessId: transaction.businessId,
      adjustmentReason: transaction.adjustmentReason ?? undefined,
      createdAt: transaction.createdAt.toISOString(),
      createdById: transaction.createdById,
      currency: transaction.currency,
      customerId: transaction.customerId ?? undefined,
      description: transaction.description ?? undefined,
      id: transaction.id,
      lines: transaction.lines.map((line) => ({
        businessId: line.businessId,
        createdAt: line.createdAt.toISOString(),
        description: line.description,
        id: line.id,
        productId: line.productId ?? undefined,
        quantity: line.quantity.toString(),
        totalAmount: line.totalAmount.toString(),
        transactionId: line.transactionId,
        unitPrice: line.unitPrice.toString(),
        updatedAt: line.updatedAt.toISOString(),
      })),
      status: transaction.status,
      supplierId: transaction.supplierId ?? undefined,
      totalAmount: transaction.totalAmount.toString(),
      transactionDate: transaction.transactionDate.toISOString(),
      type: transaction.type,
      updatedAt: transaction.updatedAt.toISOString(),
    };
  }
}
