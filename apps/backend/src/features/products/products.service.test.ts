import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it, vi } from 'vitest';
import { ProductsService } from './products.service';

const now = new Date('2026-07-10T10:00:00.000Z');
const product = {
  businessId: 'business_1',
  costPrice: null,
  createdAt: now,
  deletedAt: null,
  description: null,
  id: 'product_1',
  isActive: true,
  name: 'Chair',
  quantityOnHand: new Decimal(0),
  sku: 'CHAIR-1',
  unitPrice: new Decimal(40),
  updatedAt: now,
};

describe('ProductsService', () => {
  it('creates products under the provided businessId', async () => {
    const prisma = {
      product: {
        create: vi.fn().mockResolvedValue(product),
      },
    };
    const service = new ProductsService(prisma as never);

    await service.create('business_1', {
      name: ' Chair ',
      sku: ' CHAIR-1 ',
      unitPrice: 40,
    });

    expect(prisma.product.create).toHaveBeenCalledWith({
      data: {
        businessId: 'business_1',
        costPrice: undefined,
        description: undefined,
        isActive: true,
        name: 'Chair',
        quantityOnHand: 0,
        sku: 'CHAIR-1',
        unitPrice: 40,
      },
    });
  });

  it('lists only active products for the current business', async () => {
    const prisma = {
      product: {
        findMany: vi.fn().mockResolvedValue([product]),
      },
    };
    const service = new ProductsService(prisma as never);

    await service.list('business_1');

    expect(prisma.product.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      where: {
        businessId: 'business_1',
        deletedAt: null,
      },
    });
  });

  it('reports tenant-scoped duplicate SKU conflicts safely', async () => {
    const prisma = {
      product: {
        create: vi.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            clientVersion: '6.19.3',
            code: 'P2002',
          }),
        ),
      },
    };
    const service = new ProductsService(prisma as never);

    await expect(
      service.create('business_1', {
        name: 'Chair',
        sku: 'CHAIR-1',
        unitPrice: 40,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
