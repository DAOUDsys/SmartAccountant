import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { BusinessRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { BusinessesService } from './businesses.service';
import { CurrentBusiness } from './decorators/current-business.decorator';
import { RequireBusinessRole } from './decorators/require-business-role.decorator';
// DTO classes must stay as value imports so Nest validation metadata is emitted.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AddBusinessMemberDto } from './dto/add-business-member.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateBusinessDto } from './dto/create-business.dto';
import { BusinessMembershipGuard } from './guards/business-membership.guard';
import type { CurrentBusinessContext } from './types/businesses.types';

@Controller('businesses')
@UseGuards(JwtAuthGuard)
export class BusinessesController {
  constructor(@Inject(BusinessesService) private readonly businessesService: BusinessesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.businessesService.listForUser(user.userId);
  }

  @Get('active')
  active(@CurrentUser() user: AuthenticatedUser) {
    return this.businessesService.getActiveForUser(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBusinessDto) {
    return this.businessesService.createForUser(user.userId, dto);
  }

  @Get(':businessId')
  @UseGuards(BusinessMembershipGuard)
  getOne(@Param('businessId') businessId: string) {
    return this.businessesService.getBusinessForMember(businessId);
  }

  @Get(':businessId/members')
  @RequireBusinessRole(BusinessRole.OWNER, BusinessRole.ADMIN)
  @UseGuards(BusinessMembershipGuard)
  members(@Param('businessId') businessId: string) {
    return this.businessesService.listMembers(businessId);
  }

  @Post(':businessId/members')
  @RequireBusinessRole(BusinessRole.OWNER, BusinessRole.ADMIN)
  @UseGuards(BusinessMembershipGuard)
  addMember(
    @Param('businessId') businessId: string,
    @Body() dto: AddBusinessMemberDto,
    @CurrentBusiness() context: CurrentBusinessContext,
  ) {
    return this.businessesService.addExistingUserMember(businessId, dto, context.user.userId);
  }
}
