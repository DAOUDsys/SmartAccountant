import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessMembershipGuard } from '../businesses';
import { RequireBusinessPermission } from '../businesses/decorators/require-business-permission.decorator';
import { PostingPreviewService } from './posting-preview.service';

@Controller('businesses/:businessId/transactions/:transactionId/posting-preview')
@UseGuards(JwtAuthGuard, BusinessMembershipGuard)
export class PostingPreviewController {
  constructor(
    @Inject(PostingPreviewService)
    private readonly postingPreviewService: PostingPreviewService,
  ) {}

  @Get()
  @RequireBusinessPermission('postingPreview.read')
  getPreview(
    @Param('businessId') businessId: string,
    @Param('transactionId') transactionId: string,
  ) {
    return this.postingPreviewService.getPreview(businessId, transactionId);
  }
}
