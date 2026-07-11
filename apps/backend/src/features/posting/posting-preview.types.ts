import type {
  Account,
  AccountMapping,
  AccountMappingKey,
  Transaction,
  TransactionLine,
} from '@prisma/client';

export type PostingPreviewIssueCode =
  | 'ADJUSTMENT_REQUIRES_EXPLICIT_ACCOUNTS'
  | 'CROSS_TENANT_REFERENCE'
  | 'INACTIVE_OR_DELETED_MAPPED_ACCOUNT'
  | 'INVENTORY_COGS_NOT_INCLUDED'
  | 'LINE_TOTAL_MISMATCH'
  | 'MISSING_ACCOUNT_MAPPING'
  | 'MISSING_CURRENCY'
  | 'MISSING_CUSTOMER'
  | 'MISSING_SUPPLIER'
  | 'MISSING_TRANSACTION_LINES'
  | 'NON_POSITIVE_AMOUNT'
  | 'TRANSACTION_STATUS_NOT_PREVIEWABLE'
  | 'UNBALANCED_PREVIEW'
  | 'WRONG_MAPPED_ACCOUNT_TYPE';

export interface PostingPreviewIssue {
  code: PostingPreviewIssueCode;
  field?: string;
  message: string;
}

export interface PostingPreviewLine {
  accountCode: string;
  accountId: string;
  accountName: string;
  accountType: Account['type'];
  creditAmount: string;
  debitAmount: string;
  description: string;
  mappingKey?: AccountMappingKey;
  sourceTransactionLineId?: string;
}

export interface PostingPreviewMappingUsed {
  accountCode: string;
  accountId: string;
  accountName: string;
  key: AccountMappingKey;
}

export interface PostingPreviewResponse {
  businessId: string;
  canPost: boolean;
  currency: string;
  errors: PostingPreviewIssue[];
  isBalanced: boolean;
  lines: PostingPreviewLine[];
  mappingsUsed: PostingPreviewMappingUsed[];
  postingDate: string;
  totalCredit: string;
  totalDebit: string;
  transactionId: string;
  transactionStatus: Transaction['status'];
  transactionType: Transaction['type'];
  warnings: PostingPreviewIssue[];
}

export type TransactionIntentForPreview = Transaction & {
  lines: TransactionLine[];
};

export type AccountMappingWithAccount = AccountMapping & {
  account: Account;
};

export type AccountMappingLookup = Partial<Record<AccountMappingKey, AccountMappingWithAccount>>;
