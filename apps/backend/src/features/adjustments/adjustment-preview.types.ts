import type { Account, Transaction, TransactionAdjustmentLine } from '@prisma/client';

export type AdjustmentPreviewIssueCode =
  | 'BOTH_DEBIT_AND_CREDIT'
  | 'CROSS_TENANT_ACCOUNT_REFERENCE'
  | 'DELETED_ACCOUNT'
  | 'INACTIVE_ACCOUNT'
  | 'INVALID_ACCOUNT'
  | 'MISSING_ADJUSTMENT_LINES'
  | 'MISSING_DESCRIPTION'
  | 'MISSING_REASON'
  | 'NEGATIVE_AMOUNT'
  | 'NON_POSITIVE_TOTAL'
  | 'SENSITIVE_ACCOUNT'
  | 'TRANSACTION_NOT_DRAFT'
  | 'TRANSACTION_NOT_ADJUSTMENT'
  | 'UNBALANCED_ADJUSTMENT'
  | 'ZERO_VALUE_LINE';

export interface AdjustmentPreviewIssue {
  code: AdjustmentPreviewIssueCode;
  field?: string;
  message: string;
}

export interface AdjustmentLineResponse {
  accountCode: string;
  accountId: string;
  accountName: string;
  accountType: Account['type'];
  businessId: string;
  creditAmount: string;
  debitAmount: string;
  description?: string;
  id: string;
  transactionId: string;
}

export interface AdjustmentPreviewLine {
  accountCode: string;
  accountId: string;
  accountName: string;
  accountType: Account['type'];
  creditAmount: string;
  debitAmount: string;
  description?: string;
  sourceAdjustmentLineId: string;
}

export interface AdjustmentPreviewResponse {
  businessId: string;
  canPost: boolean;
  currency: string;
  errors: AdjustmentPreviewIssue[];
  isBalanced: boolean;
  lines: AdjustmentPreviewLine[];
  postingDate: string;
  totalCredit: string;
  totalDebit: string;
  transactionId: string;
  transactionStatus: Transaction['status'];
  transactionType: 'ADJUSTMENT';
  warnings: AdjustmentPreviewIssue[];
}

export type AdjustmentLineWithAccount = TransactionAdjustmentLine & {
  account: Account;
};
