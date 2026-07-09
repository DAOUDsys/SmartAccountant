export type AppEnvironment = 'development' | 'test' | 'production';

export interface BackendConfig {
  auth: {
    bcryptRounds: number;
    jwtAccessExpiresIn: string;
    jwtAccessSecret: string;
    jwtRefreshExpiresIn: string;
    jwtRefreshSecret: string;
  };
  environment: AppEnvironment;
  port: number;
}

const requiredEnvironmentVariables = [
  'DATABASE_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'BCRYPT_ROUNDS',
] as const;

export function validateEnvironment(config: Record<string, string | undefined>) {
  const missingVariables = requiredEnvironmentVariables.filter((key) => !config[key]);

  if (missingVariables.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}`);
  }

  const bcryptRounds = Number(config.BCRYPT_ROUNDS);

  if (!Number.isInteger(bcryptRounds) || bcryptRounds < 10 || bcryptRounds > 15) {
    throw new Error('BCRYPT_ROUNDS must be an integer between 10 and 15.');
  }

  return config;
}

export const appConfig = (): BackendConfig => ({
  auth: {
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS),
    jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
  },
  environment: (process.env.NODE_ENV as AppEnvironment | undefined) ?? 'development',
  port: Number(process.env.PORT ?? 3000),
});
