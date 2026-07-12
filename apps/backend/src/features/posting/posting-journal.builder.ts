import { BadRequestException } from '@nestjs/common';
import { AccountMappingKey, TransactionType } from '@prisma/client';
import type { Account } from '@prisma/client';
import { validateJournalLinesBalanced } from '../journals/validators/journal-balancing';
import type { AccountMappingLookup, TransactionIntentForPreview } from './posting-preview.types';

export interface PostingJournalLineInput {
  account: Account;
  creditAmount: string;
  debitAmount: string;
  description: string;
}

export interface PostingJournalBuildResult {
  lines: PostingJournalLineInput[];
  warnings: string[];
}

export function buildPostingJournalLines(
  transaction: TransactionIntentForPreview,
  mappings: AccountMappingLookup,
): PostingJournalBuildResult {
  const amount = transaction.totalAmount.toFixed(2);
  const hasProductLines = transaction.lines.some((line) => Boolean(line.productId));
  const lines: PostingJournalLineInput[] = [];
  const warnings: string[] = [];

  const account = (key: AccountMappingKey): Account => {
    const mappedAccount = mappings[key]?.account;

    if (!mappedAccount) {
      throw new BadRequestException(`Account mapping ${key} is not available for this business.`);
    }

    return mappedAccount;
  };

  const addLine = (input: {
    account: Account;
    creditAmount?: string;
    debitAmount?: string;
    description: string;
  }) => {
    lines.push({
      account: input.account,
      creditAmount: input.creditAmount ?? '0.00',
      debitAmount: input.debitAmount ?? '0.00',
      description: input.description,
    });
  };

  switch (transaction.type) {
    case TransactionType.SALE: {
      const debitKey = transaction.customerId
        ? AccountMappingKey.ACCOUNTS_RECEIVABLE
        : AccountMappingKey.CASH;

      addLine({
        account: account(debitKey),
        debitAmount: amount,
        description: transaction.customerId
          ? 'Posted sale intent to Accounts Receivable.'
          : 'Posted sale intent to Cash.',
      });
      addLine({
        account: account(AccountMappingKey.SALES_REVENUE),
        creditAmount: amount,
        description: 'Posted sale intent to Sales Revenue.',
      });

      if (hasProductLines) {
        warnings.push('Inventory and COGS posting is not implemented yet.');
      }
      break;
    }

    case TransactionType.EXPENSE:
      addLine({
        account: account(AccountMappingKey.GENERAL_EXPENSE),
        debitAmount: amount,
        description: 'Posted expense intent to General Expense.',
      });
      addLine({
        account: account(AccountMappingKey.CASH),
        creditAmount: amount,
        description: 'Posted expense intent to Cash.',
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
        account: account(debitKey),
        debitAmount: amount,
        description: hasProductLines
          ? 'Posted purchase intent to Inventory Asset.'
          : 'Posted purchase intent to General Expense.',
      });
      addLine({
        account: account(creditKey),
        creditAmount: amount,
        description: transaction.supplierId
          ? 'Posted purchase intent to Accounts Payable.'
          : 'Posted purchase intent to Cash.',
      });

      if (hasProductLines) {
        warnings.push('Inventory quantity movement is not implemented yet.');
      }
      break;
    }

    case TransactionType.CUSTOMER_PAYMENT:
      addLine({
        account: account(AccountMappingKey.CASH),
        debitAmount: amount,
        description: 'Posted customer payment intent to Cash.',
      });
      addLine({
        account: account(AccountMappingKey.ACCOUNTS_RECEIVABLE),
        creditAmount: amount,
        description: 'Posted customer payment intent to Accounts Receivable.',
      });
      break;

    case TransactionType.SUPPLIER_PAYMENT:
      addLine({
        account: account(AccountMappingKey.ACCOUNTS_PAYABLE),
        debitAmount: amount,
        description: 'Posted supplier payment intent to Accounts Payable.',
      });
      addLine({
        account: account(AccountMappingKey.CASH),
        creditAmount: amount,
        description: 'Posted supplier payment intent to Cash.',
      });
      break;

    default:
      throw new BadRequestException(
        'Posting is only supported for SALE, EXPENSE, PURCHASE, CUSTOMER_PAYMENT, SUPPLIER_PAYMENT, and ADJUSTMENT transactions.',
      );
  }

  validateJournalLinesBalanced(lines);

  return { lines, warnings };
}
