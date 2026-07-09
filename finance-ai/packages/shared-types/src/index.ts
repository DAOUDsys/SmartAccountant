export type AppEnvironment = 'development' | 'test' | 'production';

export interface ApiHealthResponse {
  service: 'finance-ai-backend';
  status: 'ok';
  timestamp: string;
  environment: AppEnvironment;
}

export interface MoneyAmount {
  amount: number;
  currency: string;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface PaginatedResponse<TItem> {
  data: TItem[];
  page: number;
  pageSize: number;
  total: number;
}
