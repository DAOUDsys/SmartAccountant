import { BadRequestException } from '@nestjs/common';
import { AccountMappingKey, TransactionType } from '@prisma/client';
import type { Account, AccountType } from '@prisma/client';
import {
  calculateJournalTotals,
  validateJournalLinesBalanced,
} from '../journals/validators/journal-balancing';
import {
  inactiveMappedAccountIssue,
  missingMappingIssue,
  wrongMappedAccountTypeIssue,
  issue,
} from './posting-preview.errors';
import { expectedAccountTypesByMappingKey } from './posting-preview.validators';
import type {
  AccountMappingLookup,
  PostingPreviewIssue,
  PostingPreviewLine,
  PostingPreviewMappingUsed,
  TransactionIntentForPreview,
} from './posting-preview.types';

interface BuildPostingPreviewResult {
  errors: PostingPreviewIssue[];
  isBalanced: boolean;
  lines: PostingPreviewLine[];
  mappingsUsed: PostingPreviewMappingUsed[];
  totalCredit: string;
  totalDebit: string;
  warnings: PostingPreviewIssue[];
}

export function buildPostingPreviewLines(
  transaction: TransactionIntentForPreview,
  mappings: AccountMappingLookup,
): BuildPostingPreviewResult {
  const errors: PostingPreviewIssue[] = [];
  const warnings: PostingPreviewIssue[] = [];
  const lines: PostingPreviewLine[] = [];
  const mappingsUsed = new Map<AccountMappingKey, PostingPreviewMappingUsed>();
  const amount = transaction.totalAmount.toFixed(2);
  const hasProductLines = transaction.lines.some((line) => Boolean(line.productId));

  const resolveAccount = (key: AccountMappingKey): Account | undefined => {
    const mapping = mappings[key];
    const expectedType = expectedAccountTypesByMappingKey[key];

    if (!mapping) {
      errors.push(missingMappingIssue(key));
      return undefined;
    }

    if (
      mapping.businessId !== transaction.businessId ||
      mapping.account.businessId !== transaction.businessId ||
      !mapping.account.isActive ||
      mapping.account.deletedAt
    ) {
      errors.push(inactiveMappedAccountIssue(key));
      return undefined;
    }

    if (mapping.account.type !== expectedType) {
      errors.push(wrongMappedAccountTypeIssue(key, expectedType, mapping.account.type));
      return undefined;
    }

    mappingsUsed.set(key, {
      accountCode: mapping.account.code,
      accountId: mapping.account.id,
      accountName: mapping.account.name,
      key,
    });

    return mapping.account;
  };

  const addLine = (input: {
    account: Account | undefined;
    creditAmount?: string;
    debitAmount?: string;
    description: string;
    mappingKey: AccountMappingKey;
  }) => {
    if (!input.account) {
      return;
    }

    lines.push({
      accountCode: input.account.code,
      accountId: input.account.id,
      accountName: input.account.name,
      accountType: input.account.type as AccountType,
      creditAmount: input.creditAmount ?? '0.00',
      debitAmount: input.debitAmount ?? '0.00',
      description: input.description,
      mappingKey: input.mappingKey,
    });
  };

  switch (transaction.type) {
    case TransactionType.SALE: {
      const debitKey = transaction.customerId
        ? AccountMappingKey.ACCOUNTS_RECEIVABLE
        : AccountMappingKey.CASH;
      addLine({
        account: resolveAccount(debitKey),
        debitAmount: amount,
        description: transaction.customerId
          ? 'Preview: would debit Accounts Receivable for sale intent.'
          : 'Preview: would debit Cash for sale intent.',
        mappingKey: debitKey,
      });
      addLine({
        account: resolveAccount(AccountMappingKey.SALES_REVENUE),
        creditAmount: amount,
        description: 'Preview: would credit Sales Revenue for sale intent.',
        mappingKey: AccountMappingKey.SALES_REVENUE,
      });

      if (hasProductLines) {
        warnings.push(
          issue(
            'INVENTORY_COGS_NOT_INCLUDED',
            'Inventory and COGS impact is not included in this preview yet.',
            'lines',
          ),
        );
      }
      break;
    }

    case TransactionType.EXPENSE:
      addLine({
        account: resolveAccount(AccountMappingKey.GENERAL_EXPENSE),
        debitAmount: amount,
        description: 'Preview: would debit General Expense for expense intent.',
        mappingKey: AccountMappingKey.GENERAL_EXPENSE,
      });
      addLine({
        account: resolveAccount(AccountMappingKey.CASH),
        creditAmount: amount,
        description: 'Preview: would credit Cash for expense intent.',
        mappingKey: AccountMappingKey.CASH,
      });
      break;

    case TransactionType.PURCHASE: {
      const debitKey = hasProductLines
        ? AccountMappingKey.INVENTORY_ASSET
        : AccountMappingKey.GENERAL_EXPENSE;
      const creditKey = transaction.supplierId
        ? AccountMappingKey.ACCOUNTS_PAYABLE
        : AccountMappingKey.CASH;
      addLine({
        account: resolveAccount(debitKey),
        debitAmount: amount,
        description: hasProductLines
          ? 'Preview: would debit Inventory Asset for purchase intent.'
          : 'Preview: would debit General Expense for purchase intent.',
        mappingKey: debitKey,
      });
      addLine({
        account: resolveAccount(creditKey),
        creditAmount: amount,
        description: transaction.supplierId
          ? 'Preview: would credit Accounts Payable for purchase intent.'
          : 'Preview: would credit Cash for purchase intent.',
        mappingKey: creditKey,
      });
      break;
    }

    case TransactionType.CUSTOMER_PAYMENT:
      addLine({
        account: resolveAccount(AccountMappingKey.CASH),
        debitAmount: amount,
        description: 'Preview: would debit Cash for customer payment intent.',
        mappingKey: AccountMappingKey.CASH,
      });
      addLine({
        account: resolveAccount(AccountMappingKey.ACCOUNTS_RECEIVABLE),
        creditAmount: amount,
        description: 'Preview: would credit Accounts Receivable for customer payment intent.',
        mappingKey: AccountMappingKey.ACCOUNTS_RECEIVABLE,
      });
      break;

    case TransactionType.SUPPLIER_PAYMENT:
      addLine({
        account: resolveAccount(AccountMappingKey.ACCOUNTS_PAYABLE),
        debitAmount: amount,
        description: 'Preview: would debit Accounts Payable for supplier payment intent.',
        mappingKey: AccountMappingKey.ACCOUNTS_PAYABLE,
      });
      addLine({
        account: resolveAccount(AccountMappingKey.CASH),
        creditAmount: amount,
        description: 'Preview: would credit Cash for supplier payment intent.',
        mappingKey: AccountMappingKey.CASH,
      });
      break;

    case TransactionType.ADJUSTMENT:
      errors.push(
        issue(
          'ADJUSTMENT_REQUIRES_EXPLICIT_ACCOUNTS',
          'Adjustment preview requires explicit debit and credit accounts before it can be built.',
          'type',
        ),
      );
      break;
  }

  const totals = calculateJournalTotals(lines);

  if (errors.length === 0) {
    const balanceError = validateGeneratedPreviewLines(lines);
    if (balanceError) {
      errors.push(balanceError);
    }
  }

  return {
    errors,
    isBalanced: totals.isBalanced,
    lines,
    mappingsUsed: [...mappingsUsed.values()],
    totalCredit: totals.totalCredit,
    totalDebit: totals.totalDebit,
    warnings,
  };
}

export function validateGeneratedPreviewLines(
  lines: Pick<PostingPreviewLine, 'creditAmount' | 'debitAmount'>[],
): PostingPreviewIssue | undefined {
  try {
    validateJournalLinesBalanced(lines);
    return undefined;
  } catch (error) {
    const message =
      error instanceof BadRequestException
        ? String(error.message)
        : 'Generated posting preview is not balanced.';

    return issue('UNBALANCED_PREVIEW', message, 'lines');
  }
}
