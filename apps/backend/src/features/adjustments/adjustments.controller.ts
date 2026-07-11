import { Body, Controller, Get, Inject, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessMembershipGuard } from '../businesses';
import { RequireBusinessPermission } from '../businesses/decorators/require-business-permission.decorator';
import { AdjustmentsService } from './adjustments.service';
// DTO class must stay as a value import so Nest validation metadata is emitted.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ReplaceAdjustmentLinesDto } from './dto/replace-adjustment-lines.dto';

@Controller('businesses/:businessId/transactions/:transactionId')
@UseGuards(JwtAuthGuard, BusinessMembershipGuard)
export class AdjustmentsController {
  constructor(
    @Inject(AdjustmentsService) private readonly adjustmentsService: AdjustmentsService,
  ) {}

  @Get('adjustment-lines')
  @RequireBusinessPermission('adjustments.read')
  listLines(
    @Param('businessId') businessId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.adjustmentsService.listLines(businessId, transactionId);
  }

  @Put('adjustment-lines')
  @RequireBusinessPermission('adjustments.manage')
  replaceLines(
    @Param('businessId') businessId: string,
    @Param('transactionId') transactionId: string,
    @Body() dto: ReplaceAdjustmentLinesDto,
  ) {
    return this.adjustmentsService.replaceLines(businessId, transactionId, dto);
  }

  @Post('adjustment-preview')
  @RequireBusinessPermission('adjustments.preview')
  preview(@Param('businessId') businessId: string, @Param('transactionId') transactionId: string) {
    return this.adjustmentsService.preview(businessId, transactionId);
  }
}
