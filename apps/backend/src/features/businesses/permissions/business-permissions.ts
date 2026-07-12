import { BusinessRole } from '@prisma/client';

export type BusinessPermission =
  | 'customers.read'
  | 'customers.manage'
  | 'suppliers.read'
  | 'suppliers.manage'
  | 'products.read'
  | 'products.manage'
  | 'transactions.read'
  | 'transactions.create'
  | 'transactions.update'
  | 'transactions.void'
  | 'accounts.read'
  | 'accounts.manage'
  | 'accountMappings.read'
  | 'accountMappings.manage'
  | 'adjustments.read'
  | 'adjustments.manage'
  | 'adjustments.preview'
  | 'adjustments.post'
  | 'journalEntries.read'
  | 'journalEntries.manage'
  | 'journalEntries.createDraft'
  | 'journalEntries.post'
  | 'journalEntries.void'
  | 'postingPreview.read'
  | 'reversals.preview'
  | 'reversals.create';

export const businessRoleOrder: Record<BusinessRole, number> = {
  [BusinessRole.OWNER]: 5,
  [BusinessRole.ADMIN]: 4,
  [BusinessRole.ACCOUNTANT]: 3,
  [BusinessRole.STAFF]: 2,
  [BusinessRole.VIEWER]: 1,
};

export const businessRolePermissions: Record<BusinessRole, BusinessPermission[]> = {
  [BusinessRole.OWNER]: [
    'customers.read',
    'customers.manage',
    'suppliers.read',
    'suppliers.manage',
    'products.read',
    'products.manage',
    'transactions.read',
    'transactions.create',
    'transactions.update',
    'transactions.void',
    'accounts.read',
    'accounts.manage',
    'accountMappings.read',
    'accountMappings.manage',
    'adjustments.read',
    'adjustments.manage',
    'adjustments.preview',
    'adjustments.post',
    'journalEntries.read',
    'journalEntries.manage',
    'journalEntries.createDraft',
    'journalEntries.post',
    'journalEntries.void',
    'postingPreview.read',
    'reversals.preview',
    'reversals.create',
  ],
  [BusinessRole.ADMIN]: [
    'customers.read',
    'customers.manage',
    'suppliers.read',
    'suppliers.manage',
    'products.read',
    'products.manage',
    'transactions.read',
    'transactions.create',
    'transactions.update',
    'transactions.void',
    'accounts.read',
    'accounts.manage',
    'accountMappings.read',
    'accountMappings.manage',
    'adjustments.read',
    'adjustments.manage',
    'adjustments.preview',
    'adjustments.post',
    'journalEntries.read',
    'journalEntries.manage',
    'journalEntries.createDraft',
    'journalEntries.post',
    'journalEntries.void',
    'postingPreview.read',
    'reversals.preview',
    'reversals.create',
  ],
  [BusinessRole.ACCOUNTANT]: [
    'customers.read',
    'customers.manage',
    'suppliers.read',
    'suppliers.manage',
    'products.read',
    'products.manage',
    'transactions.read',
    'transactions.create',
    'transactions.update',
    'transactions.void',
    'accounts.read',
    'accounts.manage',
    'accountMappings.read',
    'accountMappings.manage',
    'adjustments.read',
    'adjustments.manage',
    'adjustments.preview',
    'adjustments.post',
    'journalEntries.read',
    'journalEntries.manage',
    'journalEntries.createDraft',
    'journalEntries.post',
    'journalEntries.void',
    'postingPreview.read',
    'reversals.preview',
    'reversals.create',
  ],
  [BusinessRole.STAFF]: [
    'customers.read',
    'suppliers.read',
    'products.read',
    'transactions.read',
    'transactions.create',
    'accounts.read',
    'accountMappings.read',
  ],
  [BusinessRole.VIEWER]: [
    'customers.read',
    'suppliers.read',
    'products.read',
    'transactions.read',
    'accounts.read',
    'accountMappings.read',
    'journalEntries.read',
  ],
};

export function hasAnyBusinessRole(role: BusinessRole, allowedRoles: BusinessRole[]) {
  return allowedRoles.includes(role);
}

export function canReadBusiness(role: BusinessRole) {
  return businessRoleOrder[role] >= businessRoleOrder[BusinessRole.VIEWER];
}

export function canManageBusinessMembers(role: BusinessRole) {
  return hasAnyBusinessRole(role, [BusinessRole.OWNER, BusinessRole.ADMIN]);
}

export function hasBusinessPermission(role: BusinessRole, permission: BusinessPermission) {
  return businessRolePermissions[role].includes(permission);
}

export function hasEveryBusinessPermission(role: BusinessRole, permissions: BusinessPermission[]) {
  return permissions.every((permission) => hasBusinessPermission(role, permission));
}
