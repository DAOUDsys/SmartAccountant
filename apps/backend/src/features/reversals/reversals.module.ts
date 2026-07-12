import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ReversalPreviewService } from './reversal-preview.service';
import { ReversalService } from './reversal.service';
import { ReversalsController } from './reversals.controller';

@Module({
  controllers: [ReversalsController],
  imports: [PrismaModule],
  providers: [ReversalPreviewService, ReversalService],
})
export class ReversalsModule {}
