import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Supplier } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CreateSupplierDto } from './dto/create-supplier.dto';
import type { UpdateSupplierDto } from './dto/update-supplier.dto';

export interface SupplierResponse {
  address?: string;
  businessId: string;
  createdAt: string;
  email?: string;
  id: string;
  name: string;
  notes?: string;
  phone?: string;
  updatedAt: string;
}

@Injectable()
export class SuppliersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(businessId: string): Promise<SupplierResponse[]> {
    const suppliers = await this.prisma.supplier.findMany({
      orderBy: { createdAt: 'desc' },
      where: {
        businessId,
        deletedAt: null,
      },
    });

    return suppliers.map((supplier) => this.toResponse(supplier));
  }

  async getById(businessId: string, supplierId: string): Promise<SupplierResponse> {
    const supplier = await this.findActiveSupplier(businessId, supplierId);

    return this.toResponse(supplier);
  }

  async create(businessId: string, dto: CreateSupplierDto): Promise<SupplierResponse> {
    const supplier = await this.prisma.supplier.create({
      data: {
        address: dto.address?.trim() || undefined,
        businessId,
        email: dto.email?.trim().toLowerCase() || undefined,
        name: dto.name.trim(),
        notes: dto.notes?.trim() || undefined,
        phone: dto.phone?.trim() || undefined,
      },
    });

    return this.toResponse(supplier);
  }

  async update(
    businessId: string,
    supplierId: string,
    dto: UpdateSupplierDto,
  ): Promise<SupplierResponse> {
    await this.findActiveSupplier(businessId, supplierId);

    const supplier = await this.prisma.supplier.update({
      data: {
        address: dto.address?.trim(),
        email: dto.email?.trim().toLowerCase(),
        name: dto.name?.trim(),
        notes: dto.notes?.trim(),
        phone: dto.phone?.trim(),
      },
      where: { id: supplierId },
    });

    return this.toResponse(supplier);
  }

  async softDelete(businessId: string, supplierId: string) {
    await this.findActiveSupplier(businessId, supplierId);
    await this.prisma.supplier.update({
      data: { deletedAt: new Date() },
      where: { id: supplierId },
    });

    return { success: true };
  }

  async findActiveSupplier(businessId: string, supplierId: string): Promise<Supplier> {
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        businessId,
        deletedAt: null,
        id: supplierId,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found.');
    }

    return supplier;
  }

  toResponse(supplier: Supplier): SupplierResponse {
    return {
      address: supplier.address ?? undefined,
      businessId: supplier.businessId,
      createdAt: supplier.createdAt.toISOString(),
      email: supplier.email ?? undefined,
      id: supplier.id,
      name: supplier.name,
      notes: supplier.notes ?? undefined,
      phone: supplier.phone ?? undefined,
      updatedAt: supplier.updatedAt.toISOString(),
    };
  }
}
