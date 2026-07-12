import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

export const AUDIT_ERROR_CODES = {
  AUDIT_ACCESS_DENIED: 'AUDIT_ACCESS_DENIED',
  AUDIT_EVENT_INVALID: 'AUDIT_EVENT_INVALID',
  AUDIT_FILTER_INVALID: 'AUDIT_FILTER_INVALID',
  AUDIT_LOG_NOT_FOUND: 'AUDIT_LOG_NOT_FOUND',
  AUDIT_METADATA_REJECTED: 'AUDIT_METADATA_REJECTED',
  AUDIT_WRITE_FAILED: 'AUDIT_WRITE_FAILED',
} as const;

export class AuditEventInvalidError extends BadRequestException {
  constructor(message = 'Audit event is invalid.') {
    super({ code: AUDIT_ERROR_CODES.AUDIT_EVENT_INVALID, message });
  }
}

export class AuditMetadataRejectedError extends BadRequestException {
  constructor(message = 'Audit metadata was rejected.') {
    super({ code: AUDIT_ERROR_CODES.AUDIT_METADATA_REJECTED, message });
  }
}

export class AuditWriteFailedError extends InternalServerErrorException {
  constructor() {
    super({
      code: AUDIT_ERROR_CODES.AUDIT_WRITE_FAILED,
      message: 'Audit event could not be written.',
    });
  }
}

export class AuditAccessDeniedError extends ForbiddenException {
  constructor() {
    super({ code: AUDIT_ERROR_CODES.AUDIT_ACCESS_DENIED, message: 'Audit log access is denied.' });
  }
}

export class AuditLogNotFoundError extends NotFoundException {
  constructor() {
    super({ code: AUDIT_ERROR_CODES.AUDIT_LOG_NOT_FOUND, message: 'Audit log was not found.' });
  }
}

export class AuditFilterInvalidError extends BadRequestException {
  constructor(message = 'Audit filter is invalid.') {
    super({ code: AUDIT_ERROR_CODES.AUDIT_FILTER_INVALID, message });
  }
}
