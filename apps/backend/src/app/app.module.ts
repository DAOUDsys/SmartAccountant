import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../database/prisma.module';
import { AccountsModule } from '../features/accounts/accounts.module';
import { AuthModule } from '../features/auth/auth.module';
import { AiModule } from '../features/ai/ai.module';
import { ReportsModule } from '../features/reports/reports.module';
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
    AccountsModule,
    TransactionsModule,
    ReportsModule,
    AiModule,
  ],
})
export class AppModule {}
