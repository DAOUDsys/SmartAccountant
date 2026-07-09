export type AppEnvironment = 'development' | 'test' | 'production';

export interface BackendConfig {
  environment: AppEnvironment;
  port: number;
}

export const appConfig = (): BackendConfig => ({
  environment: (process.env.NODE_ENV as AppEnvironment | undefined) ?? 'development',
  port: Number(process.env.PORT ?? 3000),
});
