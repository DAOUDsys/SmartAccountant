import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { CurrentBusinessContext } from '../types/businesses.types';

export const CurrentBusiness = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentBusinessContext => {
    const request = context.switchToHttp().getRequest<{
      currentBusiness: CurrentBusinessContext;
    }>();

    return request.currentBusiness;
  },
);
