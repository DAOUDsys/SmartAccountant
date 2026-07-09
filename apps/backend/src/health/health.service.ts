import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnvironment } from '../config/app.config';

export interface ApiHealthResponse {
  service: 'finance-ai-backend';
  status: 'ok';
  timestamp: string;
  environment: AppEnvironment;
}

@Injectable()
export class HealthService {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  getHealth(): ApiHealthResponse {
    return {
      environment: this.configService.get<AppEnvironment>('environment', 'development'),
      service: 'finance-ai-backend',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
