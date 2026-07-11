import { BadRequestException } from '@nestjs/common';
import { Prisma, type Account } from '@prisma/client';
import { calculateJournalTotals } from '../journals/validators/journal-balancing';
import type { AdjustmentLineDto } from './dto/replace-adjustment-lines.dto';
import type { AdjustmentPreviewIssue } from './adjustment-preview.types';

export interface ValidatedAdjustmentLine {
  account: Account;
  accountId: string;
  creditAmount: string;
  debitAmount: string;
  description?: string;
}

export interface AdjustmentLineValidationResult {
  lines: ValidatedAdjustmentLine[];
  totalCredit: string;
  totalDebit: string;
}

export function adjustmentIssue(
  code: AdjustmentPreviewIssue['code'],
  message: string,
  field?: string,
): AdjustmentPreviewIssue {
  return { code, field, message };
}

export function validateAdjustmentHeader(input: {
  description?: string | null;
  reason?: string | null;
}): AdjustmentPreviewIssue[] {
  const errors: AdjustmentPreviewIssue[] = [];

  if (!input.description?.trim()) {
    errors.push(
      adjustmentIssue('MISSING_DESCRIPTION', 'Adjustment description is required.', 'description'),
    );
  }

  if (!input.reason?.trim()) {
    errors.push(adjustmentIssue('MISSING_REASON', 'Adjustment reason is required.', 'reason'));
  }

  return errors;
}

export function validateAdjustmentLines(
  businessId: string,
  inputLines: AdjustmentLineDto[],
  accounts: Account[],
): AdjustmentLineValidationResult {
  const errors: AdjustmentPreviewIssue[] = [];

  if (inputLines.length < 2) {
    errors.push(
      adjustmentIssue(
        'MISSING_ADJUSTMENT_LINES',
        'At least two adjustment lines are required.',
        'lines',
      ),
    );
  }

  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const lines = inputLines.map((line, index) => {
    const field = `lines.${index}`;
    const account = accountById.get(line.accountId);

    if (!account || account.businessId !== businessId) {
      errors.push(
        adjustmentIssue(
          'CROSS_TENANT_ACCOUNT_REFERENCE',
          'Account reference is not available for this business.',
          `${field}.accountId`,
        ),
      );
    } else if (account.deletedAt) {
      errors.push(
        adjustmentIssue(
          'DELETED_ACCOUNT',
          'Account reference is not available for this business.',
          `${field}.accountId`,
        ),
      );
    } else if (!account.isActive) {
      errors.push(
        adjustmentIssue(
          'INACTIVE_ACCOUNT',
          'Account is not active for this business.',
          `${field}.accountId`,
        ),
      );
    }

    const debit = new Prisma.Decimal(line.debitAmount ?? '0');
    const credit = new Prisma.Decimal(line.creditAmount ?? '0');

    if (debit.lt(0) || credit.lt(0)) {
      errors.push(
        adjustmentIssue('NEGATIVE_AMOUNT', 'Adjustment line amounts must be non-negative.', field),
      );
    }

    if (debit.gt(0) && credit.gt(0)) {
      errors.push(
        adjustmentIssue(
          'BOTH_DEBIT_AND_CREDIT',
          'An adjustment line cannot have both debit and credit amounts.',
          field,
        ),
      );
    }

    if (debit.equals(0) && credit.equals(0)) {
      errors.push(
        adjustmentIssue(
          'ZERO_VALUE_LINE',
          'An adjustment line must have either a debit or credit amount.',
          field,
        ),
      );
    }

    return {
      account,
      accountId: line.accountId,
      creditAmount: credit.toFixed(2),
      debitAmount: debit.toFixed(2),
      description: line.description?.trim() || undefined,
    };
  });

  const totals = calculateJournalTotals(lines);

  if (new Prisma.Decimal(totals.totalDebit).lte(0)) {
    errors.push(
      adjustmentIssue('NON_POSITIVE_TOTAL', 'Total debit must be greater than zero.', 'lines'),
    );
  }

  if (!totals.isBalanced) {
    errors.push(
      adjustmentIssue(
        'UNBALANCED_ADJUSTMENT',
        'Adjustment debits and credits must balance.',
        'lines',
      ),
    );
  }

  if (errors.length > 0) {
    throw new BadRequestException({
      errors,
      message: 'Adjustment lines are invalid.',
    });
  }

  return {
    lines: lines.map((line) => ({
      account: line.account!,
      accountId: line.accountId,
      creditAmount: line.creditAmount,
      debitAmount: line.debitAmount,
      description: line.description,
    })),
    totalCredit: totals.totalCredit,
    totalDebit: totals.totalDebit,
  };
}
