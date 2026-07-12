import { calculateJournalTotals } from '../journals/validators/journal-balancing';
import type {
  OriginalJournalEntryForReversal,
  ReversalPreviewIssue,
  ReversalPreviewLine,
} from './reversal-preview.types';

export interface ReversalPreviewBuildResult {
  isBalanced: boolean;
  lines: ReversalPreviewLine[];
  totalCredit: string;
  totalDebit: string;
  warnings: ReversalPreviewIssue[];
}

export function buildReversalPreview(
  originalJournal: OriginalJournalEntryForReversal,
): ReversalPreviewBuildResult {
  const warnings: ReversalPreviewIssue[] = [];

  const lines = originalJournal.lines.map((line) => {
    if (!line.account.isActive || line.account.deletedAt) {
      warnings.push({
        code: 'REVERSAL_ACCOUNT_INACTIVE_OR_DELETED',
        field: 'accountId',
        message:
          'Original journal uses an inactive or deleted account. Preview preserves the original ledger account; execution policy must be approved separately.',
      });
    }

    return {
      accountCode: line.account.code,
      accountId: line.accountId,
      accountName: line.account.name,
      accountType: line.account.type,
      creditAmount: line.debitAmount.toFixed(2),
      debitAmount: line.creditAmount.toFixed(2),
      description: line.description
        ? `Reversal of ${line.description}`
        : 'Reversal of original journal line.',
      originalCreditAmount: line.creditAmount.toFixed(2),
      originalDebitAmount: line.debitAmount.toFixed(2),
      originalJournalLineId: line.id,
    };
  });

  const totals = calculateJournalTotals(lines);

  return {
    isBalanced: totals.isBalanced,
    lines,
    totalCredit: totals.totalCredit,
    totalDebit: totals.totalDebit,
    warnings,
  };
}
