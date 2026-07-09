export interface AuthUser {
  createdAt: string;
  displayName?: string;
  email: string;
  id: string;
  role: 'USER' | 'ADMIN';
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: AuthUser;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  displayName?: string;
}
