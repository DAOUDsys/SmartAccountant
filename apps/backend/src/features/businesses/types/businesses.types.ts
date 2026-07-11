import type { Business, BusinessMember } from '@prisma/client';
import type { AuthenticatedUser } from '../../auth/types/auth.types';

export interface BusinessSummary {
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

export interface BusinessMemberSummary {
  businessId: string;
  createdAt: string;
  email?: string;
  displayName?: string;
  id: string;
  role: BusinessMember['role'];
  status: BusinessMember['status'];
  updatedAt: string;
  userId: string;
}

export interface BusinessWithMembership {
  business: BusinessSummary;
  membership: BusinessMemberSummary;
}

export interface CurrentBusinessContext {
  business: Business;
  membership: BusinessMember;
  user: AuthenticatedUser;
}
