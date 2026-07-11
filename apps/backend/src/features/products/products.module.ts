import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController],
  exports: [ProductsService],
  imports: [PrismaModule],
  providers: [ProductsService],
})
export class ProductsModule {}
