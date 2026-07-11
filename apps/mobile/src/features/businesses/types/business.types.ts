export type BusinessRole = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'STAFF' | 'VIEWER';

export type BusinessMemberStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';

export interface Business {
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

export interface BusinessMembership {
  businessId: string;
  createdAt: string;
  displayName?: string;
  email?: string;
  id: string;
  role: BusinessRole;
  status: BusinessMemberStatus;
  updatedAt: string;
  userId: string;
}

export interface BusinessWithMembership {
  business: Business;
  membership: BusinessMembership;
}
