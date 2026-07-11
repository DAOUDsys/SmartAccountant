import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

@Module({
  controllers: [SuppliersController],
  exports: [SuppliersService],
  imports: [PrismaModule],
  providers: [SuppliersService],
})
export class SuppliersModule {}
