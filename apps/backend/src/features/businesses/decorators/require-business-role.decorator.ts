import { SetMetadata } from '@nestjs/common';
import type { BusinessRole } from '@prisma/client';

export const requiredBusinessRolesMetadataKey = 'requiredBusinessRoles';

export const RequireBusinessRole = (...roles: BusinessRole[]) =>
  SetMetadata(requiredBusinessRolesMetadataKey, roles);
