import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  type HttpException,
} from '@nestjs/common';

export type ReversalErrorCode =
  | 'POSTED_TRANSACTION_REQUIRES_REVERSAL'
  | 'REVERSAL_ALREADY_COMPLETED'
  | 'REVERSAL_CONCURRENT_CONFLICT'
  | 'REVERSAL_DATE_REQUIRED'
  | 'REVERSAL_IDEMPOTENCY_CONFLICT'
  | 'REVERSAL_INVALID_DATE'
  | 'REVERSAL_JOURNAL_NOT_FOUND'
  | 'REVERSAL_ORIGINAL_JOURNAL_UNBALANCED'
  | 'REVERSAL_IDEMPOTENCY_KEY_REQUIRED'
  | 'REVERSAL_REASON_REQUIRED'
  | 'REVERSAL_RECONCILIATION_REQUIRED'
  | 'REVERSAL_TRANSACTION_NOT_POSTED'
  | 'TRANSACTION_ALREADY_VOIDED'
  | 'TRANSACTION_NOT_FOUND';

export interface ReversalErrorBody {
  code: ReversalErrorCode;
  message: string;
}

export function reversalBadRequest(code: ReversalErrorCode, message: string): BadRequestException {
  return new BadRequestException({ code, message });
}

export function reversalConflict(code: ReversalErrorCode, message: string): ConflictException {
  return new ConflictException({ code, message });
}

export function reversalNotFound(code: ReversalErrorCode, message: string): NotFoundException {
  return new NotFoundException({ code, message });
}

export function getReversalErrorCode(error: unknown): ReversalErrorCode | undefined {
  if (!isHttpException(error)) {
    return undefined;
  }

  const response = error.getResponse();

  if (typeof response === 'object' && response && 'code' in response) {
    return (response as ReversalErrorBody).code;
  }

  return undefined;
}

function isHttpException(error: unknown): error is HttpException {
  return Boolean(error && typeof error === 'object' && 'getResponse' in error);
}
