import type { DateRange, MoneyAmount } from '@finance-ai/shared-types';

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function formatCurrency(value: MoneyAmount, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    currency: value.currency,
    style: 'currency',
  }).format(value.amount);
}

export function isIsoDate(value: string): boolean {
  return isoDatePattern.test(value) && !Number.isNaN(Date.parse(value));
}

export function createCurrentMonthRange(now = new Date()): DateRange {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const from = new Date(Date.UTC(year, month, 1));
  const to = new Date(Date.UTC(year, month + 1, 0));

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}
