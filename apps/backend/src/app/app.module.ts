import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../database/prisma.module';
import { AccountsModule } from '../features/accounts/accounts.module';
import { AdjustmentsModule } from '../features/adjustments';
import { AuthModule } from '../features/auth/auth.module';
import { AiModule } from '../features/ai/ai.module';
import { BusinessesModule } from '../features/businesses/businesses.module';
import { CustomersModule } from '../features/customers/customers.module';
import { JournalsModule } from '../features/journals/journals.module';
import { PostingModule } from '../features/posting';
import { ProductsModule } from '../features/products/products.module';
import { ReportsModule } from '../features/reports/reports.module';
import { SuppliersModule } from '../features/suppliers/suppliers.module';
import { TransactionsModule } from '../features/transactions/transactions.module';
import { HealthModule } from '../health/health.module';
import { appConfig, validateEnvironment } from '../config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      expandVariables: true,
      isGlobal: true,
      load: [appConfig],
      validate: validateEnvironment,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    BusinessesModule,
    AccountsModule,
    AdjustmentsModule,
    CustomersModule,
    JournalsModule,
    PostingModule,
    SuppliersModule,
    ProductsModule,
    TransactionsModule,
    ReportsModule,
    AiModule,
  ],
})
export class AppModule {}
