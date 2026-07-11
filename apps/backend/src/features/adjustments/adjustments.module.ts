import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AdjustmentsController } from './adjustments.controller';
import { AdjustmentsService } from './adjustments.service';

@Module({
  controllers: [AdjustmentsController],
  exports: [AdjustmentsService],
  imports: [PrismaModule],
  providers: [AdjustmentsService],
})
export class AdjustmentsModule {}
