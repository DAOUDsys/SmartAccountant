import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { BusinessMembershipGuard } from '../businesses';
import { RequireBusinessPermission } from '../businesses/decorators/require-business-permission.decorator';
// DTO classes must stay as value imports so Nest validation metadata is emitted.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateTransactionDto } from './dto/create-transaction.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

@Controller('businesses/:businessId/transactions')
@UseGuards(JwtAuthGuard, BusinessMembershipGuard)
export class TransactionsController {
  constructor(
    @Inject(TransactionsService)
    private readonly transactionsService: TransactionsService,
  ) {}

  @Get()
  @RequireBusinessPermission('transactions.read')
  list(@Param('businessId') businessId: string) {
    return this.transactionsService.list(businessId);
  }

  @Get(':transactionId')
  @RequireBusinessPermission('transactions.read')
  getById(@Param('businessId') businessId: string, @Param('transactionId') transactionId: string) {
    return this.transactionsService.getById(businessId, transactionId);
  }

  @Post()
  @RequireBusinessPermission('transactions.create')
  create(
    @Param('businessId') businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionsService.create(businessId, user.userId, dto);
  }

  @Patch(':transactionId')
  @RequireBusinessPermission('transactions.update')
  update(
    @Param('businessId') businessId: string,
    @Param('transactionId') transactionId: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(businessId, transactionId, dto);
  }

  @Post(':transactionId/void')
  @RequireBusinessPermission('transactions.void')
  voidTransaction(
    @Param('businessId') businessId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.transactionsService.voidTransaction(businessId, transactionId);
  }
}
