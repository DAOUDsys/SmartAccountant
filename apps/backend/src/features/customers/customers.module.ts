import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  controllers: [CustomersController],
  exports: [CustomersService],
  imports: [PrismaModule],
  providers: [CustomersService],
})
export class CustomersModule {}
