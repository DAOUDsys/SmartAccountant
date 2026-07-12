import type { Account, JournalEntry, JournalLine, TransactionType } from '@prisma/client';

export interface PostedTransactionLineResponse {
  accountCode: string;
  accountId: string;
  accountName: string;
  creditAmount: string;
  debitAmount: string;
  description?: string;
}

export interface PostTransactionResponse {
  businessId: string;
  idempotencyKey: string;
  journalEntryId: string;
  lines: PostedTransactionLineResponse[];
  postedAt: string;
  status: 'POSTED';
  totalCredit: string;
  totalDebit: string;
  transactionId: string;
  transactionType: TransactionType;
  warnings: string[];
}

export type PostedJournalEntryWithLines = JournalEntry & {
  lines: Array<
    JournalLine & {
      account: Account;
    }
  >;
};
