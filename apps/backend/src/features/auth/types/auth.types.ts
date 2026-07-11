import type { UserRole } from '@prisma/client';
import type { BusinessMemberStatus, BusinessRole } from '@prisma/client';

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

export interface AuthBusiness {
  createdAt: string;
  currency: string;
  id: string;
  legalName?: string;
  locale: string;
  name: string;
  ownerId: string;
  timezone: string;
  updatedAt: string;
}

export interface AuthBusinessMembership {
  businessId: string;
  createdAt: string;
  id: string;
  role: BusinessRole;
  status: BusinessMemberStatus;
  updatedAt: string;
  userId: string;
}

export interface AuthBusinessContext {
  business: AuthBusiness;
  membership: AuthBusinessMembership;
}

export interface AuthResponse {
  businessContext?: AuthBusinessContext;
  tokens: AuthTokens;
  user: SafeUser;
}
