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
import { CreateSupplierDto } from './dto/create-supplier.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';

@Controller('businesses/:businessId/suppliers')
@UseGuards(JwtAuthGuard, BusinessMembershipGuard)
export class SuppliersController {
  constructor(@Inject(SuppliersService) private readonly suppliersService: SuppliersService) {}

  @Get()
  @RequireBusinessPermission('suppliers.read')
  list(@Param('businessId') businessId: string) {
    return this.suppliersService.list(businessId);
  }

  @Get(':supplierId')
  @RequireBusinessPermission('suppliers.read')
  getById(@Param('businessId') businessId: string, @Param('supplierId') supplierId: string) {
    return this.suppliersService.getById(businessId, supplierId);
  }

  @Post()
  @RequireBusinessPermission('suppliers.manage')
  create(@Param('businessId') businessId: string, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(businessId, dto);
  }

  @Patch(':supplierId')
  @RequireBusinessPermission('suppliers.manage')
  update(
    @Param('businessId') businessId: string,
    @Param('supplierId') supplierId: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(businessId, supplierId, dto);
  }

  @Delete(':supplierId')
  @RequireBusinessPermission('suppliers.manage')
  softDelete(@Param('businessId') businessId: string, @Param('supplierId') supplierId: string) {
    return this.suppliersService.softDelete(businessId, supplierId);
  }
}
