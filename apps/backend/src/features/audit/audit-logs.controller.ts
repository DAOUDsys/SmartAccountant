import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentBusiness } from '../businesses/decorators/current-business.decorator';
import { BusinessMembershipGuard } from '../businesses/guards/business-membership.guard';
import { RequireBusinessPermission } from '../businesses/decorators/require-business-permission.decorator';
import type { CurrentBusinessContext } from '../businesses/types/businesses.types';
import { AuditLogService } from './audit-log.service';
import type { AuditLogFilters } from './audit-log.service';

@Controller('businesses/:businessId/audit-logs')
@UseGuards(JwtAuthGuard, BusinessMembershipGuard)
export class AuditLogsController {
  constructor(@Inject(AuditLogService) private readonly auditLogService: AuditLogService) {}

  @Get()
  @RequireBusinessPermission('auditLogs.read')
  list(
    @Param('businessId') businessId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessContext,
    @Query() query: AuditLogFilters,
  ) {
    return this.auditLogService.findBusinessEvents(
      businessId,
      currentBusiness.membership.role,
      query,
    );
  }

  @Get(':auditLogId')
  @RequireBusinessPermission('auditLogs.read')
  getById(
    @Param('businessId') businessId: string,
    @Param('auditLogId') auditLogId: string,
    @CurrentBusiness() currentBusiness: CurrentBusinessContext,
  ) {
    return this.auditLogService.findBusinessEventById(
      businessId,
      auditLogId,
      currentBusiness.membership.role,
    );
  }
}
