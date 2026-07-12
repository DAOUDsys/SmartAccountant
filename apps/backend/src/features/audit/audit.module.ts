import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuditLogsController } from './audit-logs.controller';
import { AuditLogService } from './audit-log.service';

@Module({
  controllers: [AuditLogsController],
  exports: [AuditLogService],
  imports: [PrismaModule],
  providers: [AuditLogService],
})
export class AuditModule {}
