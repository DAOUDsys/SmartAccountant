import { Body, Controller, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { CurrentBusiness } from '../businesses/decorators/current-business.decorator';
import { BusinessMembershipGuard } from '../businesses/guards/business-membership.guard';
import type { CurrentBusinessContext } from '../businesses/types/businesses.types';
// DTO class must stay as a value import so Nest validation metadata is emitted.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PostTransactionDto } from './dto/post-transaction.dto';
import { PostingService } from './posting.service';

@Controller('businesses/:businessId/transactions/:transactionId/post')
@UseGuards(JwtAuthGuard, BusinessMembershipGuard)
export class PostingController {
  constructor(@Inject(PostingService) private readonly postingService: PostingService) {}

  @Post()
  postTransaction(
    @Param('businessId') businessId: string,
    @Param('transactionId') transactionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentBusiness() context: CurrentBusinessContext,
    @Body() dto: PostTransactionDto,
  ) {
    return this.postingService.postTransaction(
      businessId,
      transactionId,
      user.userId,
      context.membership.role,
      dto,
    );
  }
}
