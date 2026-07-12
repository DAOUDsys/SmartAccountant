import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { BackendRequestContext, RequestWithAuditContext } from './request-context.middleware';

export const RequestContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): BackendRequestContext | undefined => {
    const request = context.switchToHttp().getRequest<RequestWithAuditContext>();
    return request.requestContext;
  },
);
