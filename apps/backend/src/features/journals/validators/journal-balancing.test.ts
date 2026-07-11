import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { calculateJournalTotals, validateJournalLinesBalanced } from './journal-balancing';

describe('journal balancing validators', () => {
  it('calculates totals for balanced lines', () => {
    expect(
      calculateJournalTotals([
        { debitAmount: 200, creditAmount: 0 },
        { debitAmount: 0, creditAmount: 200 },
      ]),
    ).toEqual({
      isBalanced: true,
      totalCredit: '200.00',
      totalDebit: '200.00',
    });
  });

  it('accepts valid debit and credit lines', () => {
    expect(() =>
      validateJournalLinesBalanced([{ debitAmount: 200 }, { creditAmount: 200 }]),
    ).not.toThrow();
  });

  it('rejects unbalanced lines', () => {
    expect(() =>
      validateJournalLinesBalanced([{ debitAmount: 200 }, { creditAmount: 199 }]),
    ).toThrow(BadRequestException);
  });

  it('rejects a line with both debit and credit', () => {
    expect(() =>
      validateJournalLinesBalanced([{ debitAmount: 200, creditAmount: 1 }, { creditAmount: 201 }]),
    ).toThrow(BadRequestException);
  });

  it('rejects zero-value lines', () => {
    expect(() =>
      validateJournalLinesBalanced([{ debitAmount: 0, creditAmount: 0 }, { creditAmount: 200 }]),
    ).toThrow(BadRequestException);
  });

  it('rejects less than two lines', () => {
    expect(() => validateJournalLinesBalanced([{ debitAmount: 200 }])).toThrow(BadRequestException);
  });
});
