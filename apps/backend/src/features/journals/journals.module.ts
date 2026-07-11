import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { JournalsController } from './journals.controller';
import { JournalsService } from './journals.service';

@Module({
  controllers: [JournalsController],
  exports: [JournalsService],
  imports: [PrismaModule],
  providers: [JournalsService],
})
export class JournalsModule {}
