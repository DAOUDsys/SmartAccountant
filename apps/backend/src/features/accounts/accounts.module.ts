import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  controllers: [AccountsController],
  exports: [AccountsService],
  imports: [PrismaModule],
  providers: [AccountsService],
})
export class AccountsModule {}
