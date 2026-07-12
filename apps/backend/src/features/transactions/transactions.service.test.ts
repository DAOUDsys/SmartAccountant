import { ConflictException, NotFoundException } from '@nestjs/common';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it, vi } from 'vitest';
import { getReversalErrorCode } from '../reversals/reversal.errors';
import { TransactionsService } from './transactions.service';

const now = new Date('2026-07-10T10:00:00.000Z');
const transaction = {
  businessId: 'business_1',
  createdAt: now,
  createdById: 'user_1',
  currency: 'USD',
  customerId: 'customer_1',
  deletedAt: null,
  description: null,
  id: 'transaction_1',
  lines: [
    {
      businessId: 'business_1',
      createdAt: now,
      description: 'Chair',
      id: 'line_1',
      productId: 'product_1',
      quantity: new Decimal(5),
      totalAmount: new Decimal(200),
      transactionId: 'transaction_1',
      unitPrice: new Decimal(40),
      updatedAt: now,
    },
  ],
  status: TransactionStatus.DRAFT,
  supplierId: null,
  totalAmount: new Decimal(200),
  transactionDate: now,
  type: TransactionType.SALE,
  updatedAt: now,
};

describe('TransactionsService', () => {
  it('creates transactions under the provided businessId', async () => {
    const prisma = {
      customer: {
        findFirst: vi.fn().mockResolvedValue({ id: 'customer_1' }),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([{ id: 'product_1' }]),
      },
      supplier: {
        findFirst: vi.fn(),
      },
      transaction: {
        create: vi.fn().mockResolvedValue(transaction),
      },
    };
    const service = new TransactionsService(prisma as never);

    await service.create('business_1', 'user_1', {
      currency: 'usd',
      customerId: 'customer_1',
      lines: [
        {
          description: ' Chair ',
          productId: 'product_1',
          quantity: 5,
          totalAmount: 200,
          unitPrice: 40,
        },
      ],
      totalAmount: 200,
      transactionDate: now.toISOString(),
      type: TransactionType.SALE,
    });

    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: {
        businessId: 'business_1',
        deletedAt: null,
        id: 'customer_1',
      },
    });
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        businessId: 'business_1',
        deletedAt: null,
        id: {
          in: ['product_1'],
        },
      },
    });
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: {
        businessId: 'business_1',
        createdById: 'user_1',
        currency: 'USD',
        customerId: 'customer_1',
        description: undefined,
        lines: {
          create: [
            {
              businessId: 'business_1',
              description: 'Chair',
              productId: 'product_1',
              quantity: 5,
              totalAmount: 200,
              unitPrice: 40,
            },
          ],
        },
        status: TransactionStatus.DRAFT,
        supplierId: undefined,
        totalAmount: 200,
        transactionDate: now,
        type: TransactionType.SALE,
      },
      include: { lines: true },
    });
  });

  it('rejects transactions that reference a customer from another business', async () => {
    const prisma = {
      customer: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new TransactionsService(prisma as never);

    await expect(
      service.create('business_1', 'user_1', {
        currency: 'USD',
        customerId: 'customer_from_other_business',
        totalAmount: 200,
        transactionDate: now.toISOString(),
        type: TransactionType.SALE,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects transactions that reference a supplier from another business', async () => {
    const prisma = {
      customer: {
        findFirst: vi.fn(),
      },
      supplier: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = new TransactionsService(prisma as never);

    await expect(
      service.create('business_1', 'user_1', {
        currency: 'USD',
        supplierId: 'supplier_from_other_business',
        totalAmount: 50,
        transactionDate: now.toISOString(),
        type: TransactionType.EXPENSE,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects transaction lines that reference products from another business', async () => {
    const prisma = {
      customer: {
        findFirst: vi.fn(),
      },
      product: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      supplier: {
        findFirst: vi.fn(),
      },
    };
    const service = new TransactionsService(prisma as never);

    await expect(
      service.create('business_1', 'user_1', {
        currency: 'USD',
        lines: [
          {
            description: 'Chair',
            productId: 'product_from_other_business',
            quantity: 5,
            totalAmount: 200,
            unitPrice: 40,
          },
        ],
        totalAmount: 200,
        transactionDate: now.toISOString(),
        type: TransactionType.SALE,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists only active transactions for the current business', async () => {
    const prisma = {
      transaction: {
        findMany: vi.fn().mockResolvedValue([transaction]),
      },
    };
    const service = new TransactionsService(prisma as never);

    await service.list('business_1');

    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      include: { lines: true },
      orderBy: { transactionDate: 'desc' },
      where: {
        businessId: 'business_1',
        deletedAt: null,
      },
    });
  });

  it('voids transactions for permitted callers without deleting them', async () => {
    const prisma = {
      transaction: {
        findFirst: vi.fn().mockResolvedValue(transaction),
        update: vi.fn().mockResolvedValue({
          ...transaction,
          status: TransactionStatus.VOIDED,
        }),
      },
    };
    const service = new TransactionsService(prisma as never);

    const result = await service.voidTransaction('business_1', 'transaction_1');

    expect(prisma.transaction.update).toHaveBeenCalledWith({
      data: { status: TransactionStatus.VOIDED },
      include: { lines: true },
      where: { id: 'transaction_1' },
    });
    expect(result.status).toBe(TransactionStatus.VOIDED);
  });

  it('rejects direct void for POSTED transactions and leaves status unchanged', async () => {
    const prisma = {
      transaction: {
        findFirst: vi.fn().mockResolvedValue({
          ...transaction,
          status: TransactionStatus.POSTED,
        }),
        update: vi.fn(),
      },
    };
    const service = new TransactionsService(prisma as never);

    try {
      await service.voidTransaction('business_1', 'transaction_1');
      throw new Error('Expected POSTED void to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect(getReversalErrorCode(error)).toBe('POSTED_TRANSACTION_REQUIRES_REVERSAL');
    }

    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });

  it('rejects repeated void for already VOIDED transactions', async () => {
    const prisma = {
      transaction: {
        findFirst: vi.fn().mockResolvedValue({
          ...transaction,
          status: TransactionStatus.VOIDED,
        }),
        update: vi.fn(),
      },
    };
    const service = new TransactionsService(prisma as never);

    try {
      await service.voidTransaction('business_1', 'transaction_1');
      throw new Error('Expected repeated VOIDED cancellation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect(getReversalErrorCode(error)).toBe('TRANSACTION_ALREADY_VOIDED');
    }

    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });
});
