import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';
import { BusinessMembershipGuard } from './guards/business-membership.guard';

@Module({
  controllers: [BusinessesController],
  exports: [BusinessesService, BusinessMembershipGuard],
  imports: [PrismaModule],
  providers: [BusinessesService, BusinessMembershipGuard],
})
export class BusinessesModule {}
