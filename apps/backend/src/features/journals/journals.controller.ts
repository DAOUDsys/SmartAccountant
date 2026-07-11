import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { BusinessMembershipGuard } from '../businesses';
import { RequireBusinessPermission } from '../businesses/decorators/require-business-permission.decorator';
// DTO classes must stay as value imports so Nest validation metadata is emitted.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateJournalDraftDto } from './dto/create-journal-draft.dto';
import { JournalsService } from './journals.service';

@Controller('businesses/:businessId/journal-entries')
@UseGuards(JwtAuthGuard, BusinessMembershipGuard)
export class JournalsController {
  constructor(@Inject(JournalsService) private readonly journalsService: JournalsService) {}

  @Get()
  @RequireBusinessPermission('journalEntries.read')
  list(
    @Param('businessId') businessId: string,
    @Query('status') status?: string,
    @Query('sourceTransactionId') sourceTransactionId?: string,
  ) {
    return this.journalsService.list(businessId, { sourceTransactionId, status });
  }

  @Get(':journalEntryId')
  @RequireBusinessPermission('journalEntries.read')
  getById(
    @Param('businessId') businessId: string,
    @Param('journalEntryId') journalEntryId: string,
  ) {
    return this.journalsService.getById(businessId, journalEntryId);
  }

  @Post('draft')
  @RequireBusinessPermission('journalEntries.createDraft')
  createDraft(
    @Param('businessId') businessId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateJournalDraftDto,
  ) {
    return this.journalsService.createDraft(businessId, user.userId, dto);
  }
}
