import { Body, Controller, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { BusinessMembershipGuard } from '../businesses';
import { RequireBusinessPermission } from '../businesses/decorators/require-business-permission.decorator';
// DTO class must stay as a value import so Nest validation metadata is emitted.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReverseTransactionDto } from './dto/reverse-transaction.dto';
// DTO class must stay as a value import so Nest validation metadata is emitted.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReversalPreviewDto } from './dto/reversal-preview.dto';
import { ReversalPreviewService } from './reversal-preview.service';
import { ReversalService } from './reversal.service';

@Controller('businesses/:businessId/transactions/:transactionId')
@UseGuards(JwtAuthGuard, BusinessMembershipGuard)
export class ReversalsController {
  constructor(
    @Inject(ReversalPreviewService)
    private readonly reversalPreviewService: ReversalPreviewService,
    @Inject(ReversalService)
    private readonly reversalService: ReversalService,
  ) {}

  @Post('reversal-preview')
  @RequireBusinessPermission('reversals.preview')
  preview(
    @Param('businessId') businessId: string,
    @Param('transactionId') transactionId: string,
    @Body() dto: ReversalPreviewDto,
  ) {
    return this.reversalPreviewService.preview(businessId, transactionId, dto);
  }

  @Post('reverse')
  @RequireBusinessPermission('reversals.create')
  reverse(
    @Param('businessId') businessId: string,
    @Param('transactionId') transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReverseTransactionDto,
  ) {
    return this.reversalService.reverseTransaction(businessId, transactionId, user.userId, dto);
  }
}
