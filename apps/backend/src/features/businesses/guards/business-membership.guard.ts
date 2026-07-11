import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BusinessMemberStatus, type BusinessRole } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import type { AuthenticatedUser } from '../../auth/types/auth.types';
import { requiredBusinessPermissionsMetadataKey } from '../decorators/require-business-permission.decorator';
import { requiredBusinessRolesMetadataKey } from '../decorators/require-business-role.decorator';
import {
  hasAnyBusinessRole,
  hasEveryBusinessPermission,
  type BusinessPermission,
} from '../permissions/business-permissions';
import type { CurrentBusinessContext } from '../types/businesses.types';

interface BusinessRequest {
  currentBusiness?: CurrentBusinessContext;
  params?: {
    businessId?: string;
  };
  user?: AuthenticatedUser;
}

@Injectable()
export class BusinessMembershipGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<BusinessRequest>();
    const user = request.user;
    const businessId = request.params?.businessId;

    if (!user) {
      throw new ForbiddenException('Authentication is required.');
    }

    if (!businessId) {
      throw new BadRequestException('Business id is required.');
    }

    const membership = await this.prisma.businessMember.findFirst({
      include: { business: true },
      where: {
        businessId,
        status: BusinessMemberStatus.ACTIVE,
        userId: user.userId,
        business: {
          deletedAt: null,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this business.');
    }

    const requiredRoles = this.reflector.getAllAndOverride<BusinessRole[]>(
      requiredBusinessRolesMetadataKey,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles?.length && !hasAnyBusinessRole(membership.role, requiredRoles)) {
      throw new ForbiddenException('You do not have permission to perform this business action.');
    }

    const requiredPermissions = this.reflector.getAllAndOverride<BusinessPermission[]>(
      requiredBusinessPermissionsMetadataKey,
      [context.getHandler(), context.getClass()],
    );

    if (
      requiredPermissions?.length &&
      !hasEveryBusinessPermission(membership.role, requiredPermissions)
    ) {
      throw new ForbiddenException('You do not have permission to perform this business action.');
    }

    request.currentBusiness = {
      business: membership.business,
      membership,
      user,
    };

    return true;
  }
}
