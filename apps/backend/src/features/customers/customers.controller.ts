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
import { CustomersService } from './customers.service';
// DTO classes must stay as value imports so Nest validation metadata is emitted.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateCustomerDto } from './dto/create-customer.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('businesses/:businessId/customers')
@UseGuards(JwtAuthGuard, BusinessMembershipGuard)
export class CustomersController {
  constructor(@Inject(CustomersService) private readonly customersService: CustomersService) {}

  @Get()
  @RequireBusinessPermission('customers.read')
  list(@Param('businessId') businessId: string) {
    return this.customersService.list(businessId);
  }

  @Get(':customerId')
  @RequireBusinessPermission('customers.read')
  getById(@Param('businessId') businessId: string, @Param('customerId') customerId: string) {
    return this.customersService.getById(businessId, customerId);
  }

  @Post()
  @RequireBusinessPermission('customers.manage')
  create(@Param('businessId') businessId: string, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(businessId, dto);
  }

  @Patch(':customerId')
  @RequireBusinessPermission('customers.manage')
  update(
    @Param('businessId') businessId: string,
    @Param('customerId') customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(businessId, customerId, dto);
  }

  @Delete(':customerId')
  @RequireBusinessPermission('customers.manage')
  softDelete(@Param('businessId') businessId: string, @Param('customerId') customerId: string) {
    return this.customersService.softDelete(businessId, customerId);
  }
}
