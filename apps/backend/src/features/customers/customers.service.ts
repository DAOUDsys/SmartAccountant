import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Customer } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';

export interface CustomerResponse {
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
export class CustomersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(businessId: string): Promise<CustomerResponse[]> {
    const customers = await this.prisma.customer.findMany({
      orderBy: { createdAt: 'desc' },
      where: {
        businessId,
        deletedAt: null,
      },
    });

    return customers.map((customer) => this.toResponse(customer));
  }

  async getById(businessId: string, customerId: string): Promise<CustomerResponse> {
    const customer = await this.findActiveCustomer(businessId, customerId);

    return this.toResponse(customer);
  }

  async create(businessId: string, dto: CreateCustomerDto): Promise<CustomerResponse> {
    const customer = await this.prisma.customer.create({
      data: {
        address: dto.address?.trim() || undefined,
        businessId,
        email: dto.email?.trim().toLowerCase() || undefined,
        name: dto.name.trim(),
        notes: dto.notes?.trim() || undefined,
        phone: dto.phone?.trim() || undefined,
      },
    });

    return this.toResponse(customer);
  }

  async update(
    businessId: string,
    customerId: string,
    dto: UpdateCustomerDto,
  ): Promise<CustomerResponse> {
    await this.findActiveCustomer(businessId, customerId);

    const customer = await this.prisma.customer.update({
      data: {
        address: dto.address?.trim(),
        email: dto.email?.trim().toLowerCase(),
        name: dto.name?.trim(),
        notes: dto.notes?.trim(),
        phone: dto.phone?.trim(),
      },
      where: { id: customerId },
    });

    return this.toResponse(customer);
  }

  async softDelete(businessId: string, customerId: string) {
    await this.findActiveCustomer(businessId, customerId);
    await this.prisma.customer.update({
      data: { deletedAt: new Date() },
      where: { id: customerId },
    });

    return { success: true };
  }

  async findActiveCustomer(businessId: string, customerId: string): Promise<Customer> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        businessId,
        deletedAt: null,
        id: customerId,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    return customer;
  }

  toResponse(customer: Customer): CustomerResponse {
    return {
      address: customer.address ?? undefined,
      businessId: customer.businessId,
      createdAt: customer.createdAt.toISOString(),
      email: customer.email ?? undefined,
      id: customer.id,
      name: customer.name,
      notes: customer.notes ?? undefined,
      phone: customer.phone ?? undefined,
      updatedAt: customer.updatedAt.toISOString(),
    };
  }
}
