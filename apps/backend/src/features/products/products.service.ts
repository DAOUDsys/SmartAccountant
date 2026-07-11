import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Product } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';

export interface ProductResponse {
  businessId: string;
  costPrice?: string;
  createdAt: string;
  description?: string;
  id: string;
  isActive: boolean;
  name: string;
  quantityOnHand: string;
  sku?: string;
  unitPrice: string;
  updatedAt: string;
}

@Injectable()
export class ProductsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(businessId: string): Promise<ProductResponse[]> {
    const products = await this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
      where: {
        businessId,
        deletedAt: null,
      },
    });

    return products.map((product) => this.toResponse(product));
  }

  async getById(businessId: string, productId: string): Promise<ProductResponse> {
    const product = await this.findActiveProduct(businessId, productId);

    return this.toResponse(product);
  }

  async create(businessId: string, dto: CreateProductDto): Promise<ProductResponse> {
    try {
      const product = await this.prisma.product.create({
        data: {
          businessId,
          costPrice: dto.costPrice,
          description: dto.description?.trim() || undefined,
          isActive: dto.isActive ?? true,
          name: dto.name.trim(),
          quantityOnHand: dto.quantityOnHand ?? 0,
          sku: dto.sku?.trim() || undefined,
          unitPrice: dto.unitPrice,
        },
      });

      return this.toResponse(product);
    } catch (error) {
      this.handleKnownPrismaError(error);
      throw error;
    }
  }

  async update(
    businessId: string,
    productId: string,
    dto: UpdateProductDto,
  ): Promise<ProductResponse> {
    await this.findActiveProduct(businessId, productId);

    try {
      const product = await this.prisma.product.update({
        data: {
          costPrice: dto.costPrice,
          description: dto.description?.trim(),
          isActive: dto.isActive,
          name: dto.name?.trim(),
          quantityOnHand: dto.quantityOnHand,
          sku: dto.sku?.trim(),
          unitPrice: dto.unitPrice,
        },
        where: { id: productId },
      });

      return this.toResponse(product);
    } catch (error) {
      this.handleKnownPrismaError(error);
      throw error;
    }
  }

  async softDelete(businessId: string, productId: string) {
    await this.findActiveProduct(businessId, productId);
    await this.prisma.product.update({
      data: { deletedAt: new Date() },
      where: { id: productId },
    });

    return { success: true };
  }

  async findActiveProduct(businessId: string, productId: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: {
        businessId,
        deletedAt: null,
        id: productId,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    return product;
  }

  toResponse(product: Product): ProductResponse {
    return {
      businessId: product.businessId,
      costPrice: product.costPrice?.toString(),
      createdAt: product.createdAt.toISOString(),
      description: product.description ?? undefined,
      id: product.id,
      isActive: product.isActive,
      name: product.name,
      quantityOnHand: product.quantityOnHand.toString(),
      sku: product.sku ?? undefined,
      unitPrice: product.unitPrice.toString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }

  private handleKnownPrismaError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Product SKU already exists for this business.');
    }
  }
}
