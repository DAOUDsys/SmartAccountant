import { JournalEntryStatus } from '@prisma/client';
import { validateJournalLinesBalanced } from '../journals/validators/journal-balancing';
import { getReversalErrorCode, reversalBadRequest, reversalConflict } from './reversal.errors';
import type { OriginalJournalEntryForReversal } from './reversal-preview.types';

export function requireReversalReason(reason: string | undefined): string {
  const trimmed = reason?.trim();

  if (!trimmed) {
    throw reversalBadRequest('REVERSAL_REASON_REQUIRED', 'Reversal reason is required.');
  }

  return trimmed;
}

export function requireReversalDate(reversalDate: string | undefined): string {
  const trimmed = reversalDate?.trim();

  if (!trimmed) {
    throw reversalBadRequest('REVERSAL_DATE_REQUIRED', 'Reversal date is required.');
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    throw reversalBadRequest('REVERSAL_INVALID_DATE', 'Reversal date must be a valid date.');
  }

  return trimmed;
}

export function requireReversalIdempotencyKey(idempotencyKey: string | undefined): string {
  const trimmed = idempotencyKey?.trim();

  if (!trimmed) {
    throw reversalBadRequest(
      'REVERSAL_IDEMPOTENCY_KEY_REQUIRED',
      'Reversal idempotency key is required.',
    );
  }

  return trimmed;
}

export function assertOriginalJournalCanBeReversed(
  businessId: string,
  originalJournal: OriginalJournalEntryForReversal,
) {
  if (originalJournal.reversesJournalEntryId) {
    throw reversalConflict(
      'REVERSAL_RECONCILIATION_REQUIRED',
      'Original journal candidate is itself a reversal. Reconciliation is required.',
    );
  }

  if (
    originalJournal.status === JournalEntryStatus.REVERSED ||
    originalJournal.reversedByJournalEntry
  ) {
    throw reversalConflict(
      'REVERSAL_ALREADY_COMPLETED',
      'This posted journal already has a reversal.',
    );
  }

  if (originalJournal.status !== JournalEntryStatus.POSTED) {
    throw reversalConflict(
      'REVERSAL_RECONCILIATION_REQUIRED',
      'Original journal entry is not POSTED. Reconciliation is required.',
    );
  }

  for (const line of originalJournal.lines) {
    if (line.account.businessId !== businessId) {
      throw reversalConflict(
        'REVERSAL_RECONCILIATION_REQUIRED',
        'Original journal contains an account outside this business. Reconciliation is required.',
      );
    }
  }

  try {
    validateJournalLinesBalanced(originalJournal.lines);
  } catch (error) {
    if (getReversalErrorCode(error)) {
      throw error;
    }

    throw reversalConflict(
      'REVERSAL_ORIGINAL_JOURNAL_UNBALANCED',
      'Original journal entry is not balanced. Reconciliation is required.',
    );
  }
}
