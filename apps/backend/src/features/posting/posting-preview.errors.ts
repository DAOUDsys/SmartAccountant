import type { AccountMappingKey, AccountType } from '@prisma/client';
import type { PostingPreviewIssue } from './posting-preview.types';

export function issue(
  code: PostingPreviewIssue['code'],
  message: string,
  field?: string,
): PostingPreviewIssue {
  return { code, field, message };
}

export function missingMappingIssue(key: AccountMappingKey): PostingPreviewIssue {
  return issue(
    'MISSING_ACCOUNT_MAPPING',
    `Account mapping ${key} is not available for this business.`,
    `accountMappings.${key}`,
  );
}

export function inactiveMappedAccountIssue(key: AccountMappingKey): PostingPreviewIssue {
  return issue(
    'INACTIVE_OR_DELETED_MAPPED_ACCOUNT',
    `Account mapping ${key} does not resolve to an active account for this business.`,
    `accountMappings.${key}`,
  );
}

export function wrongMappedAccountTypeIssue(
  key: AccountMappingKey,
  expectedType: AccountType,
  actualType: AccountType,
): PostingPreviewIssue {
  return issue(
    'WRONG_MAPPED_ACCOUNT_TYPE',
    `Account mapping ${key} must resolve to a ${expectedType} account, but resolved to ${actualType}.`,
    `accountMappings.${key}`,
  );
}
