import { BusinessRole } from '@prisma/client';

export const AUDIT_EVENTS = {
  AUTH_REGISTER_SUCCEEDED: 'AUTH_REGISTER_SUCCEEDED',
  AUTH_REGISTER_FAILED: 'AUTH_REGISTER_FAILED',
  AUTH_LOGIN_SUCCEEDED: 'AUTH_LOGIN_SUCCEEDED',
  AUTH_LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
  AUTH_REFRESH_SUCCEEDED: 'AUTH_REFRESH_SUCCEEDED',
  AUTH_REFRESH_FAILED: 'AUTH_REFRESH_FAILED',
  AUTH_LOGOUT_SUCCEEDED: 'AUTH_LOGOUT_SUCCEEDED',
  BUSINESS_CREATED: 'BUSINESS_CREATED',
  BUSINESS_MEMBER_ADDED: 'BUSINESS_MEMBER_ADDED',
  BUSINESS_MEMBER_ROLE_CHANGED: 'BUSINESS_MEMBER_ROLE_CHANGED',
  BUSINESS_MEMBER_STATUS_CHANGED: 'BUSINESS_MEMBER_STATUS_CHANGED',
  BUSINESS_ACCESS_DENIED: 'BUSINESS_ACCESS_DENIED',
  ACCOUNT_CREATED: 'ACCOUNT_CREATED',
  ACCOUNT_UPDATED: 'ACCOUNT_UPDATED',
  ACCOUNT_DELETED: 'ACCOUNT_DELETED',
  ACCOUNT_MAPPING_UPDATED: 'ACCOUNT_MAPPING_UPDATED',
  CUSTOMER_CREATED: 'CUSTOMER_CREATED',
  CUSTOMER_UPDATED: 'CUSTOMER_UPDATED',
  CUSTOMER_DELETED: 'CUSTOMER_DELETED',
  SUPPLIER_CREATED: 'SUPPLIER_CREATED',
  SUPPLIER_UPDATED: 'SUPPLIER_UPDATED',
  SUPPLIER_DELETED: 'SUPPLIER_DELETED',
  PRODUCT_CREATED: 'PRODUCT_CREATED',
  PRODUCT_UPDATED: 'PRODUCT_UPDATED',
  PRODUCT_DELETED: 'PRODUCT_DELETED',
  TRANSACTION_CREATED: 'TRANSACTION_CREATED',
  TRANSACTION_UPDATED: 'TRANSACTION_UPDATED',
  TRANSACTION_DRAFT_VOIDED: 'TRANSACTION_DRAFT_VOIDED',
  ADJUSTMENT_LINES_REPLACED: 'ADJUSTMENT_LINES_REPLACED',
  POSTING_PREVIEW_REQUESTED: 'POSTING_PREVIEW_REQUESTED',
  TRANSACTION_POST_ATTEMPTED: 'TRANSACTION_POST_ATTEMPTED',
  TRANSACTION_POST_SUCCEEDED: 'TRANSACTION_POST_SUCCEEDED',
  TRANSACTION_POST_FAILED: 'TRANSACTION_POST_FAILED',
  TRANSACTION_POST_IDEMPOTENT_RETRY: 'TRANSACTION_POST_IDEMPOTENT_RETRY',
  TRANSACTION_POST_DENIED: 'TRANSACTION_POST_DENIED',
  REVERSAL_PREVIEW_REQUESTED: 'REVERSAL_PREVIEW_REQUESTED',
  TRANSACTION_REVERSAL_ATTEMPTED: 'TRANSACTION_REVERSAL_ATTEMPTED',
  TRANSACTION_REVERSAL_SUCCEEDED: 'TRANSACTION_REVERSAL_SUCCEEDED',
  TRANSACTION_REVERSAL_FAILED: 'TRANSACTION_REVERSAL_FAILED',
  TRANSACTION_REVERSAL_IDEMPOTENT_RETRY: 'TRANSACTION_REVERSAL_IDEMPOTENT_RETRY',
  TRANSACTION_REVERSAL_DENIED: 'TRANSACTION_REVERSAL_DENIED',
  JOURNAL_DRAFT_CREATED: 'JOURNAL_DRAFT_CREATED',
  JOURNAL_DRAFT_VOIDED: 'JOURNAL_DRAFT_VOIDED',
  JOURNAL_READ_DENIED: 'JOURNAL_READ_DENIED',
} as const;

export type AuditEventType = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS];

export type AuditEventCategory =
  'AUTH_SECURITY' | 'TENANCY_SECURITY' | 'ACCOUNTING' | 'ADMINISTRATIVE';

export interface AuditEventDefinition {
  action: string;
  allowedMetadataKeys: readonly string[];
  category: AuditEventCategory;
  requiresBusinessId: boolean;
  readableByRoles: readonly BusinessRole[];
}

const accountingRoles = [BusinessRole.OWNER, BusinessRole.ADMIN, BusinessRole.ACCOUNTANT] as const;
const securityRoles = [BusinessRole.OWNER, BusinessRole.ADMIN] as const;
const administrativeRoles = [BusinessRole.OWNER, BusinessRole.ADMIN] as const;

const commonMetadataKeys = [
  'accountId',
  'accountMappingKey',
  'actorRole',
  'attemptedEmailFingerprint',
  'changedFields',
  'currency',
  'customerId',
  'idempotencyKeyFingerprint',
  'journalEntryId',
  'lineCount',
  'memberUserId',
  'newRole',
  'newStatus',
  'originalJournalEntryId',
  'previousRole',
  'previousStatus',
  'productId',
  'reversalJournalEntryId',
  'source',
  'supplierId',
  'totalCredit',
  'totalDebit',
  'transactionId',
  'transactionStatusAfter',
  'transactionStatusBefore',
  'transactionType',
] as const;

function define(
  category: AuditEventCategory,
  action: string,
  requiresBusinessId: boolean,
  readableByRoles: readonly BusinessRole[],
  extraMetadataKeys: readonly string[] = [],
): AuditEventDefinition {
  return {
    action,
    allowedMetadataKeys: [...commonMetadataKeys, ...extraMetadataKeys],
    category,
    readableByRoles,
    requiresBusinessId,
  };
}

export const auditEventCatalog: Record<AuditEventType, AuditEventDefinition> = {
  [AUDIT_EVENTS.AUTH_REGISTER_SUCCEEDED]: define('AUTH_SECURITY', 'register', false, securityRoles),
  [AUDIT_EVENTS.AUTH_REGISTER_FAILED]: define('AUTH_SECURITY', 'register', false, securityRoles),
  [AUDIT_EVENTS.AUTH_LOGIN_SUCCEEDED]: define('AUTH_SECURITY', 'login', false, securityRoles),
  [AUDIT_EVENTS.AUTH_LOGIN_FAILED]: define('AUTH_SECURITY', 'login', false, securityRoles),
  [AUDIT_EVENTS.AUTH_REFRESH_SUCCEEDED]: define('AUTH_SECURITY', 'refresh', false, securityRoles),
  [AUDIT_EVENTS.AUTH_REFRESH_FAILED]: define('AUTH_SECURITY', 'refresh', false, securityRoles),
  [AUDIT_EVENTS.AUTH_LOGOUT_SUCCEEDED]: define('AUTH_SECURITY', 'logout', false, securityRoles),
  [AUDIT_EVENTS.BUSINESS_CREATED]: define('ADMINISTRATIVE', 'create', true, administrativeRoles),
  [AUDIT_EVENTS.BUSINESS_MEMBER_ADDED]: define('TENANCY_SECURITY', 'create', true, securityRoles),
  [AUDIT_EVENTS.BUSINESS_MEMBER_ROLE_CHANGED]: define(
    'TENANCY_SECURITY',
    'update',
    true,
    securityRoles,
  ),
  [AUDIT_EVENTS.BUSINESS_MEMBER_STATUS_CHANGED]: define(
    'TENANCY_SECURITY',
    'update',
    true,
    securityRoles,
  ),
  [AUDIT_EVENTS.BUSINESS_ACCESS_DENIED]: define('TENANCY_SECURITY', 'deny', true, securityRoles),
  [AUDIT_EVENTS.ACCOUNT_CREATED]: define('ACCOUNTING', 'create', true, accountingRoles),
  [AUDIT_EVENTS.ACCOUNT_UPDATED]: define('ACCOUNTING', 'update', true, accountingRoles),
  [AUDIT_EVENTS.ACCOUNT_DELETED]: define('ACCOUNTING', 'delete', true, accountingRoles),
  [AUDIT_EVENTS.ACCOUNT_MAPPING_UPDATED]: define('ACCOUNTING', 'update', true, accountingRoles),
  [AUDIT_EVENTS.CUSTOMER_CREATED]: define('ACCOUNTING', 'create', true, accountingRoles),
  [AUDIT_EVENTS.CUSTOMER_UPDATED]: define('ACCOUNTING', 'update', true, accountingRoles),
  [AUDIT_EVENTS.CUSTOMER_DELETED]: define('ACCOUNTING', 'delete', true, accountingRoles),
  [AUDIT_EVENTS.SUPPLIER_CREATED]: define('ACCOUNTING', 'create', true, accountingRoles),
  [AUDIT_EVENTS.SUPPLIER_UPDATED]: define('ACCOUNTING', 'update', true, accountingRoles),
  [AUDIT_EVENTS.SUPPLIER_DELETED]: define('ACCOUNTING', 'delete', true, accountingRoles),
  [AUDIT_EVENTS.PRODUCT_CREATED]: define('ACCOUNTING', 'create', true, accountingRoles),
  [AUDIT_EVENTS.PRODUCT_UPDATED]: define('ACCOUNTING', 'update', true, accountingRoles),
  [AUDIT_EVENTS.PRODUCT_DELETED]: define('ACCOUNTING', 'delete', true, accountingRoles),
  [AUDIT_EVENTS.TRANSACTION_CREATED]: define('ACCOUNTING', 'create', true, accountingRoles),
  [AUDIT_EVENTS.TRANSACTION_UPDATED]: define('ACCOUNTING', 'update', true, accountingRoles),
  [AUDIT_EVENTS.TRANSACTION_DRAFT_VOIDED]: define('ACCOUNTING', 'void', true, accountingRoles),
  [AUDIT_EVENTS.ADJUSTMENT_LINES_REPLACED]: define('ACCOUNTING', 'update', true, accountingRoles),
  [AUDIT_EVENTS.POSTING_PREVIEW_REQUESTED]: define('ACCOUNTING', 'preview', true, accountingRoles),
  [AUDIT_EVENTS.TRANSACTION_POST_ATTEMPTED]: define('ACCOUNTING', 'post', true, accountingRoles),
  [AUDIT_EVENTS.TRANSACTION_POST_SUCCEEDED]: define('ACCOUNTING', 'post', true, accountingRoles),
  [AUDIT_EVENTS.TRANSACTION_POST_FAILED]: define('ACCOUNTING', 'post', true, accountingRoles),
  [AUDIT_EVENTS.TRANSACTION_POST_IDEMPOTENT_RETRY]: define(
    'ACCOUNTING',
    'retry',
    true,
    accountingRoles,
  ),
  [AUDIT_EVENTS.TRANSACTION_POST_DENIED]: define('ACCOUNTING', 'deny', true, accountingRoles),
  [AUDIT_EVENTS.REVERSAL_PREVIEW_REQUESTED]: define('ACCOUNTING', 'preview', true, accountingRoles),
  [AUDIT_EVENTS.TRANSACTION_REVERSAL_ATTEMPTED]: define(
    'ACCOUNTING',
    'reverse',
    true,
    accountingRoles,
  ),
  [AUDIT_EVENTS.TRANSACTION_REVERSAL_SUCCEEDED]: define(
    'ACCOUNTING',
    'reverse',
    true,
    accountingRoles,
  ),
  [AUDIT_EVENTS.TRANSACTION_REVERSAL_FAILED]: define(
    'ACCOUNTING',
    'reverse',
    true,
    accountingRoles,
  ),
  [AUDIT_EVENTS.TRANSACTION_REVERSAL_IDEMPOTENT_RETRY]: define(
    'ACCOUNTING',
    'retry',
    true,
    accountingRoles,
  ),
  [AUDIT_EVENTS.TRANSACTION_REVERSAL_DENIED]: define('ACCOUNTING', 'deny', true, accountingRoles),
  [AUDIT_EVENTS.JOURNAL_DRAFT_CREATED]: define('ACCOUNTING', 'create', true, accountingRoles),
  [AUDIT_EVENTS.JOURNAL_DRAFT_VOIDED]: define('ACCOUNTING', 'void', true, accountingRoles),
  [AUDIT_EVENTS.JOURNAL_READ_DENIED]: define('ACCOUNTING', 'deny', true, accountingRoles),
};

export function getAuditEventDefinition(eventType: string): AuditEventDefinition | undefined {
  return auditEventCatalog[eventType as AuditEventType];
}

export function isKnownAuditEvent(eventType: string): eventType is AuditEventType {
  return eventType in auditEventCatalog;
}

export function readableAuditCategoriesForRole(role: BusinessRole): AuditEventCategory[] {
  if (role === BusinessRole.OWNER || role === BusinessRole.ADMIN) {
    return ['AUTH_SECURITY', 'TENANCY_SECURITY', 'ACCOUNTING', 'ADMINISTRATIVE'];
  }

  if (role === BusinessRole.ACCOUNTANT) {
    return ['ACCOUNTING'];
  }

  return [];
}
