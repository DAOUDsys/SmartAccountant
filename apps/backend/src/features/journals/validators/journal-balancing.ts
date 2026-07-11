import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface JournalLineAmountInput {
  creditAmount?: number | string | Prisma.Decimal;
  debitAmount?: number | string | Prisma.Decimal;
}

export interface JournalTotals {
  isBalanced: boolean;
  totalCredit: string;
  totalDebit: string;
}

export function calculateJournalTotals(lines: JournalLineAmountInput[]): JournalTotals {
  const totals = lines.reduce(
    (accumulator, line) => {
      const debitAmount = toDecimal(line.debitAmount);
      const creditAmount = toDecimal(line.creditAmount);

      return {
        totalCredit: accumulator.totalCredit.plus(creditAmount),
        totalDebit: accumulator.totalDebit.plus(debitAmount),
      };
    },
    {
      totalCredit: new Prisma.Decimal(0),
      totalDebit: new Prisma.Decimal(0),
    },
  );

  return {
    isBalanced: totals.totalDebit.equals(totals.totalCredit),
    totalCredit: totals.totalCredit.toFixed(2),
    totalDebit: totals.totalDebit.toFixed(2),
  };
}

export function validateJournalLinesBalanced(lines: JournalLineAmountInput[]): JournalTotals {
  if (lines.length < 2) {
    throw new BadRequestException('A journal entry requires at least two lines.');
  }

  for (const line of lines) {
    const debitAmount = toDecimal(line.debitAmount);
    const creditAmount = toDecimal(line.creditAmount);

    if (debitAmount.lt(0) || creditAmount.lt(0)) {
      throw new BadRequestException('Journal line amounts must be non-negative.');
    }

    if (debitAmount.gt(0) && creditAmount.gt(0)) {
      throw new BadRequestException('A journal line cannot have both debit and credit amounts.');
    }

    if (debitAmount.equals(0) && creditAmount.equals(0)) {
      throw new BadRequestException('A journal line must have either a debit or a credit amount.');
    }
  }

  const totals = calculateJournalTotals(lines);

  if (new Prisma.Decimal(totals.totalDebit).lte(0)) {
    throw new BadRequestException('Total debit must be greater than zero.');
  }

  if (!totals.isBalanced) {
    throw new BadRequestException('Journal entry debits and credits must balance.');
  }

  return totals;
}

function toDecimal(value: number | string | Prisma.Decimal | undefined): Prisma.Decimal {
  return new Prisma.Decimal(value ?? 0);
}
