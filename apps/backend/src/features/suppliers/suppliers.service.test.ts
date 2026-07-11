import { describe, expect, it, vi } from 'vitest';
import { SuppliersService } from './suppliers.service';

const now = new Date('2026-07-10T10:00:00.000Z');
const supplier = {
  address: null,
  businessId: 'business_1',
  createdAt: now,
  deletedAt: null,
  email: null,
  id: 'supplier_1',
  name: 'Stationery Plus',
  notes: null,
  phone: null,
  updatedAt: now,
};

describe('SuppliersService', () => {
  it('creates suppliers under the provided businessId', async () => {
    const prisma = {
      supplier: {
        create: vi.fn().mockResolvedValue(supplier),
      },
    };
    const service = new SuppliersService(prisma as never);

    await service.create('business_1', { name: ' Stationery Plus ' });

    expect(prisma.supplier.create).toHaveBeenCalledWith({
      data: {
        address: undefined,
        businessId: 'business_1',
        email: undefined,
        name: 'Stationery Plus',
        notes: undefined,
        phone: undefined,
      },
    });
  });

  it('lists only active suppliers for the current business', async () => {
    const prisma = {
      supplier: {
        findMany: vi.fn().mockResolvedValue([supplier]),
      },
    };
    const service = new SuppliersService(prisma as never);

    await service.list('business_1');

    expect(prisma.supplier.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      where: {
        businessId: 'business_1',
        deletedAt: null,
      },
    });
  });
});
