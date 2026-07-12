import type {
  Account,
  AccountType,
  JournalEntry,
  JournalEntryStatus,
  JournalLine,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '@prisma/client';

export interface ReversalPreviewIssue {
  code: string;
  field?: string;
  message: string;
}

export interface ReversalPreviewLine {
  accountCode: string;
  accountId: string;
  accountName: string;
  accountType: AccountType;
  creditAmount: string;
  debitAmount: string;
  description: string;
  originalCreditAmount: string;
  originalDebitAmount: string;
  originalJournalLineId: string;
}

export interface ReversalPreviewResponse {
  businessId: string;
  canReverse: boolean;
  errors: ReversalPreviewIssue[];
  isBalanced: boolean;
  lines: ReversalPreviewLine[];
  originalJournalEntryId: string;
  originalJournalStatus: JournalEntryStatus;
  reason: string;
  reversalDate: string;
  totalCredit: string;
  totalDebit: string;
  transactionId: string;
  transactionStatus: TransactionStatus;
  transactionType: TransactionType;
  warnings: ReversalPreviewIssue[];
}

export interface ReverseTransactionLine {
  accountCode: string;
  accountId: string;
  accountName: string;
  accountType: AccountType;
  creditAmount: string;
  debitAmount: string;
  description?: string;
  originalJournalLineId?: string;
}

export interface ReverseTransactionResponse {
  businessId: string;
  idempotencyKey: string;
  lines: ReverseTransactionLine[];
  originalJournalEntryId: string;
  originalJournalStatus: 'REVERSED';
  reason: string;
  reversalDate: string;
  reversalJournalEntryId: string;
  reversalJournalStatus: 'POSTED';
  reversedAt: string;
  totalCredit: string;
  totalDebit: string;
  transactionId: string;
  transactionStatus: 'VOIDED';
  transactionType: TransactionType;
  warnings: ReversalPreviewIssue[];
}

export type OriginalJournalLineForReversal = JournalLine & {
  account: Account;
};

export type OriginalJournalEntryForReversal = JournalEntry & {
  lines: OriginalJournalLineForReversal[];
  reversedByJournalEntry?: JournalEntry | null;
};

export type TransactionForReversalPreview = Transaction;

export type ReversalJournalEntryForResponse = JournalEntry & {
  lines: OriginalJournalLineForReversal[];
  reversesJournalEntry?: JournalEntry | null;
  sourceTransaction?: Transaction | null;
};
