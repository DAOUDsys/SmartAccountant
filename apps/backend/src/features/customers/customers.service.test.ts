import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CustomersService } from './customers.service';

const now = new Date('2026-07-10T10:00:00.000Z');
const customer = {
  address: null,
  businessId: 'business_1',
  createdAt: now,
  deletedAt: null,
  email: null,
  id: 'customer_1',
  name: 'Ahmed',
  notes: null,
  phone: null,
  updatedAt: now,
};

function createService(prisma: unknown) {
  return new CustomersService(prisma as never);
}

describe('CustomersService', () => {
  it('creates customers under the provided businessId', async () => {
    const prisma = {
      customer: {
        create: vi.fn().mockResolvedValue(customer),
      },
    };
    const service = createService(prisma);

    await service.create('business_1', { name: ' Ahmed ' });

    expect(prisma.customer.create).toHaveBeenCalledWith({
      data: {
        address: undefined,
        businessId: 'business_1',
        email: undefined,
        name: 'Ahmed',
        notes: undefined,
        phone: undefined,
      },
    });
  });

  it('lists only active customers for the current business', async () => {
    const prisma = {
      customer: {
        findMany: vi.fn().mockResolvedValue([customer]),
      },
    };
    const service = createService(prisma);

    const result = await service.list('business_1');

    expect(prisma.customer.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      where: {
        businessId: 'business_1',
        deletedAt: null,
      },
    });
    expect(result).toHaveLength(1);
  });

  it('fails safely when a customer id belongs to another business or is deleted', async () => {
    const prisma = {
      customer: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(service.getById('business_1', 'customer_2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.customer.findFirst).toHaveBeenCalledWith({
      where: {
        businessId: 'business_1',
        deletedAt: null,
        id: 'customer_2',
      },
    });
  });

  it('soft-deletes customers so they disappear from normal lists', async () => {
    const prisma = {
      customer: {
        findFirst: vi.fn().mockResolvedValue(customer),
        update: vi.fn().mockResolvedValue({ ...customer, deletedAt: now }),
      },
    };
    const service = createService(prisma);

    await service.softDelete('business_1', 'customer_1');

    expect(prisma.customer.update).toHaveBeenCalledWith({
      data: { deletedAt: expect.any(Date) as Date },
      where: { id: 'customer_1' },
    });
  });
});
