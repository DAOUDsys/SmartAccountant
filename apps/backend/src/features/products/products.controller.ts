import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessMembershipGuard } from '../businesses';
import { RequireBusinessPermission } from '../businesses/decorators/require-business-permission.decorator';
// DTO classes must stay as value imports so Nest validation metadata is emitted.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateProductDto } from './dto/create-product.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@Controller('businesses/:businessId/products')
@UseGuards(JwtAuthGuard, BusinessMembershipGuard)
export class ProductsController {
  constructor(@Inject(ProductsService) private readonly productsService: ProductsService) {}

  @Get()
  @RequireBusinessPermission('products.read')
  list(@Param('businessId') businessId: string) {
    return this.productsService.list(businessId);
  }

  @Get(':productId')
  @RequireBusinessPermission('products.read')
  getById(@Param('businessId') businessId: string, @Param('productId') productId: string) {
    return this.productsService.getById(businessId, productId);
  }

  @Post()
  @RequireBusinessPermission('products.manage')
  create(@Param('businessId') businessId: string, @Body() dto: CreateProductDto) {
    return this.productsService.create(businessId, dto);
  }

  @Patch(':productId')
  @RequireBusinessPermission('products.manage')
  update(
    @Param('businessId') businessId: string,
    @Param('productId') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(businessId, productId, dto);
  }

  @Delete(':productId')
  @RequireBusinessPermission('products.manage')
  softDelete(@Param('businessId') businessId: string, @Param('productId') productId: string) {
    return this.productsService.softDelete(businessId, productId);
  }
}
