import { AccountMappingKey, AccountType, Prisma, TransactionStatus } from '@prisma/client';
import { issue } from './posting-preview.errors';
import type { PostingPreviewIssue, TransactionIntentForPreview } from './posting-preview.types';

export const expectedAccountTypesByMappingKey: Record<AccountMappingKey, AccountType> = {
  [AccountMappingKey.ACCOUNTS_PAYABLE]: AccountType.LIABILITY,
  [AccountMappingKey.ACCOUNTS_RECEIVABLE]: AccountType.ASSET,
  [AccountMappingKey.CASH]: AccountType.ASSET,
  [AccountMappingKey.COST_OF_GOODS_SOLD]: AccountType.EXPENSE,
  [AccountMappingKey.GENERAL_EXPENSE]: AccountType.EXPENSE,
  [AccountMappingKey.INVENTORY_ASSET]: AccountType.ASSET,
  [AccountMappingKey.OWNER_EQUITY]: AccountType.EQUITY,
  [AccountMappingKey.SALES_REVENUE]: AccountType.REVENUE,
};

export function validatePreviewableTransactionStatus(
  transaction: TransactionIntentForPreview,
): PostingPreviewIssue[] {
  if (transaction.status === TransactionStatus.DRAFT) {
    return [];
  }

  if (transaction.status === TransactionStatus.POSTED) {
    return [
      issue(
        'TRANSACTION_STATUS_NOT_PREVIEWABLE',
        'This transaction has an intent status of POSTED, but ledger posting is not available yet. Preview is blocked until posting reconciliation is designed.',
        'status',
      ),
    ];
  }

  return [
    issue(
      'TRANSACTION_STATUS_NOT_PREVIEWABLE',
      'Voided transaction intents cannot be previewed for posting.',
      'status',
    ),
  ];
}

export function validateTransactionIntentAmounts(
  transaction: TransactionIntentForPreview,
): PostingPreviewIssue[] {
  const errors: PostingPreviewIssue[] = [];

  if (!transaction.currency.trim()) {
    errors.push(issue('MISSING_CURRENCY', 'Transaction currency is required.', 'currency'));
  }

  if (transaction.lines.length === 0) {
    errors.push(
      issue('MISSING_TRANSACTION_LINES', 'Transaction must have at least one line.', 'lines'),
    );
  }

  const totalAmount = new Prisma.Decimal(transaction.totalAmount);
  if (totalAmount.lte(0)) {
    errors.push(
      issue(
        'NON_POSITIVE_AMOUNT',
        'Transaction total amount must be greater than zero.',
        'totalAmount',
      ),
    );
  }

  const lineTotal = transaction.lines.reduce(
    (sum, line) => sum.plus(line.totalAmount),
    new Prisma.Decimal(0),
  );

  if (!lineTotal.equals(totalAmount)) {
    errors.push(
      issue(
        'LINE_TOTAL_MISMATCH',
        'Transaction line totals must match the transaction total amount.',
        'lines',
      ),
    );
  }

  transaction.lines.forEach((line) => {
    if (
      new Prisma.Decimal(line.quantity).lte(0) ||
      new Prisma.Decimal(line.unitPrice).lt(0) ||
      new Prisma.Decimal(line.totalAmount).lte(0)
    ) {
      errors.push(
        issue(
          'NON_POSITIVE_AMOUNT',
          'Transaction line quantity and total must be positive, and unit price must be non-negative.',
          `lines.${line.id}`,
        ),
      );
    }
  });

  return errors;
}
