import { SetMetadata } from '@nestjs/common';
import type { BusinessPermission } from '../permissions/business-permissions';

export const requiredBusinessPermissionsMetadataKey = 'requiredBusinessPermissions';

export const RequireBusinessPermission = (...permissions: BusinessPermission[]) =>
  SetMetadata(requiredBusinessPermissionsMetadataKey, permissions);
