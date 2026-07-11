import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController],
  exports: [TransactionsService],
  imports: [PrismaModule],
  providers: [TransactionsService],
})
export class TransactionsModule {}
