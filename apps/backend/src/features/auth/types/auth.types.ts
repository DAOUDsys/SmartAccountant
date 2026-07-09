import type { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  email: string;
  role: UserRole;
  userId: string;
}

export interface SafeUser {
  createdAt: string;
  displayName?: string;
  email: string;
  id: string;
  role: UserRole;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: SafeUser;
}
