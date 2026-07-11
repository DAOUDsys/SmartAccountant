import { calculateJournalTotals } from '../journals/validators/journal-balancing';
import { adjustmentIssue } from './adjustment-line.validators';
import type {
  AdjustmentLineWithAccount,
  AdjustmentPreviewIssue,
  AdjustmentPreviewLine,
} from './adjustment-preview.types';

const sensitiveAccountNames = new Set([
  'Accounts Payable',
  'Accounts Receivable',
  'Cost of Goods Sold',
  'Inventory Asset',
  'Owner Equity',
  'Sales Revenue',
]);

export function buildAdjustmentPreview(lines: AdjustmentLineWithAccount[]) {
  const previewLines: AdjustmentPreviewLine[] = lines.map((line) => ({
    accountCode: line.account.code,
    accountId: line.accountId,
    accountName: line.account.name,
    accountType: line.account.type,
    creditAmount: line.creditAmount.toFixed(2),
    debitAmount: line.debitAmount.toFixed(2),
    description: line.description ?? undefined,
    sourceAdjustmentLineId: line.id,
  }));
  const totals = calculateJournalTotals(previewLines);

  return {
    lines: previewLines,
    totalCredit: totals.totalCredit,
    totalDebit: totals.totalDebit,
    warnings: sensitiveAccountWarnings(lines),
  };
}

function sensitiveAccountWarnings(lines: AdjustmentLineWithAccount[]): AdjustmentPreviewIssue[] {
  const warnings = new Map<string, AdjustmentPreviewIssue>();

  for (const line of lines) {
    if (line.account.isSystem) {
      warnings.set(
        'SENSITIVE_SYSTEM_ACCOUNT',
        adjustmentIssue(
          'SENSITIVE_ACCOUNT',
          'This adjustment uses a system account. Review carefully before posting.',
          'lines.accountId',
        ),
      );
    }

    if (sensitiveAccountNames.has(line.account.name)) {
      warnings.set(
        `SENSITIVE_${line.account.name}`,
        adjustmentIssue(
          'SENSITIVE_ACCOUNT',
          `This adjustment uses ${line.account.name}. Review carefully before posting.`,
          'lines.accountId',
        ),
      );
    }
  }

  return [...warnings.values()];
}
