export type TransactionType =
  'SALE' | 'EXPENSE' | 'PURCHASE' | 'CUSTOMER_PAYMENT' | 'SUPPLIER_PAYMENT' | 'ADJUSTMENT';

export type TransactionStatus = 'DRAFT' | 'POSTED' | 'VOIDED';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export type NormalBalance = 'DEBIT' | 'CREDIT';

export type AccountMappingKey =
  | 'CASH'
  | 'ACCOUNTS_RECEIVABLE'
  | 'ACCOUNTS_PAYABLE'
  | 'SALES_REVENUE'
  | 'COST_OF_GOODS_SOLD'
  | 'INVENTORY_ASSET'
  | 'GENERAL_EXPENSE'
  | 'OWNER_EQUITY';

export type JournalEntryStatus = 'DRAFT' | 'PENDING' | 'POSTED' | 'VOIDED' | 'REVERSED';

export interface Customer {
  address?: string;
  businessId: string;
  createdAt: string;
  email?: string;
  id: string;
  name: string;
  notes?: string;
  phone?: string;
  updatedAt: string;
}

export type Supplier = Customer;

export interface Product {
  businessId: string;
  costPrice?: string;
  createdAt: string;
  description?: string;
  id: string;
  isActive: boolean;
  name: string;
  quantityOnHand: string;
  sku?: string;
  unitPrice: string;
  updatedAt: string;
}

export interface TransactionLine {
  businessId: string;
  createdAt: string;
  description: string;
  id: string;
  productId?: string;
  quantity: string;
  totalAmount: string;
  transactionId: string;
  unitPrice: string;
  updatedAt: string;
}

export interface Transaction {
  adjustmentReason?: string;
  businessId: string;
  createdAt: string;
  createdById: string;
  currency: string;
  customerId?: string;
  description?: string;
  id: string;
  lines: TransactionLine[];
  status: TransactionStatus;
  supplierId?: string;
  totalAmount: string;
  transactionDate: string;
  type: TransactionType;
  updatedAt: string;
}

export interface Account {
  businessId: string;
  code: string;
  createdAt: string;
  description?: string;
  id: string;
  isActive: boolean;
  isSystem: boolean;
  name: string;
  normalBalance: NormalBalance;
  parentId?: string;
  type: AccountType;
  updatedAt: string;
}

export interface AccountMapping {
  account: Account;
  accountId: string;
  businessId: string;
  createdAt: string;
  id: string;
  key: AccountMappingKey;
  updatedAt: string;
}

export interface JournalLine {
  accountId: string;
  createdAt: string;
  creditAmount: string;
  debitAmount: string;
  description?: string;
  id: string;
  journalEntryId: string;
  updatedAt: string;
}

export interface JournalTotals {
  isBalanced: boolean;
  totalCredit: string;
  totalDebit: string;
}

export interface JournalEntry {
  businessId: string;
  createdAt: string;
  createdById: string;
  description: string;
  id: string;
  idempotencyKey: string;
  lineCount: number;
  lines: JournalLine[];
  postedAt?: string;
  postingDate: string;
  sourceTransactionId?: string;
  status: JournalEntryStatus;
  totals: JournalTotals;
  updatedAt: string;
  voidedAt?: string;
  voidedById?: string;
}

export type PostingPreviewIssueCode =
  | 'ADJUSTMENT_REQUIRES_EXPLICIT_ACCOUNTS'
  | 'CROSS_TENANT_REFERENCE'
  | 'INACTIVE_OR_DELETED_MAPPED_ACCOUNT'
  | 'INVENTORY_COGS_NOT_INCLUDED'
  | 'LINE_TOTAL_MISMATCH'
  | 'MISSING_ACCOUNT_MAPPING'
  | 'MISSING_CURRENCY'
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
  accountType: AccountType;
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

export interface PostingPreview {
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
  transactionStatus: TransactionStatus;
  transactionType: TransactionType;
  warnings: PostingPreviewIssue[];
}

export type PostingSource = 'MANUAL' | 'SYSTEM_RETRY' | 'IMPORT';

export interface PostTransactionRequest {
  idempotencyKey: string;
  postingDate?: string;
  source?: PostingSource;
}

export interface PostedTransactionLine {
  accountCode: string;
  accountId: string;
  accountName: string;
  creditAmount: string;
  debitAmount: string;
}

export interface PostTransactionResult {
  businessId: string;
  idempotencyKey: string;
  journalEntryId: string;
  lines: PostedTransactionLine[];
  postedAt: string;
  status: 'POSTED';
  totalCredit: string;
  totalDebit: string;
  transactionId: string;
  warnings: string[];
}

export interface AdjustmentLine {
  accountCode: string;
  accountId: string;
  accountName: string;
  accountType: AccountType;
  businessId: string;
  creditAmount: string;
  debitAmount: string;
  description?: string;
  id: string;
  transactionId: string;
}

export interface ReplaceAdjustmentLineInput {
  accountId: string;
  creditAmount?: string;
  debitAmount?: string;
  description?: string;
}

export interface ReplaceAdjustmentLinesRequest {
  description: string;
  lines: ReplaceAdjustmentLineInput[];
  postingDate: string;
  reason: string;
}

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

export interface AdjustmentPreviewLine {
  accountCode: string;
  accountId: string;
  accountName: string;
  accountType: AccountType;
  creditAmount: string;
  debitAmount: string;
  description?: string;
  sourceAdjustmentLineId: string;
}

export interface AdjustmentPreview {
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
  transactionStatus: TransactionStatus;
  transactionType: 'ADJUSTMENT';
  warnings: AdjustmentPreviewIssue[];
}
