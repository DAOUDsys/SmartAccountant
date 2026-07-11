import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessMemberStatus,
  BusinessRole,
  type Business,
  type BusinessMember,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { createDefaultAccountsForBusiness } from '../accounts';
import type { AddBusinessMemberDto } from './dto/add-business-member.dto';
import type { CreateBusinessDto } from './dto/create-business.dto';
import type {
  BusinessMemberSummary,
  BusinessSummary,
  BusinessWithMembership,
} from './types/businesses.types';

type BusinessMemberWithUser = BusinessMember & {
  user: {
    displayName: string | null;
    email: string;
  };
};

@Injectable()
export class BusinessesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<BusinessWithMembership[]> {
    const memberships = await this.prisma.businessMember.findMany({
      include: { business: true },
      orderBy: { createdAt: 'asc' },
      where: {
        status: BusinessMemberStatus.ACTIVE,
        userId,
        business: {
          deletedAt: null,
        },
      },
    });

    return memberships.map((membership) => ({
      business: this.toBusinessSummary(membership.business),
      membership: this.toBusinessMemberSummary(membership),
    }));
  }

  async getActiveForUser(userId: string): Promise<BusinessWithMembership | null> {
    const membership = await this.prisma.businessMember.findFirst({
      include: { business: true },
      orderBy: { createdAt: 'asc' },
      where: {
        status: BusinessMemberStatus.ACTIVE,
        userId,
        business: {
          deletedAt: null,
        },
      },
    });

    if (!membership) {
      return null;
    }

    return {
      business: this.toBusinessSummary(membership.business),
      membership: this.toBusinessMemberSummary(membership),
    };
  }

  async createForUser(userId: string, dto: CreateBusinessDto): Promise<BusinessWithMembership> {
    const trimmedName = dto.name.trim();

    const result = await this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          currency: dto.currency?.trim().toUpperCase() || undefined,
          legalName: dto.legalName?.trim() || undefined,
          locale: dto.locale?.trim() || undefined,
          name: trimmedName,
          ownerId: userId,
          timezone: dto.timezone?.trim() || undefined,
        },
      });
      await createDefaultAccountsForBusiness(tx, business.id);
      const membership = await tx.businessMember.create({
        data: {
          businessId: business.id,
          role: BusinessRole.OWNER,
          status: BusinessMemberStatus.ACTIVE,
          userId,
        },
      });

      return { business, membership };
    });

    return {
      business: this.toBusinessSummary(result.business),
      membership: this.toBusinessMemberSummary(result.membership),
    };
  }

  async getBusinessForMember(businessId: string): Promise<BusinessSummary> {
    const business = await this.prisma.business.findFirst({
      where: {
        deletedAt: null,
        id: businessId,
      },
    });

    if (!business) {
      throw new NotFoundException('Business not found.');
    }

    return this.toBusinessSummary(business);
  }

  async listMembers(businessId: string): Promise<BusinessMemberSummary[]> {
    const members = await this.prisma.businessMember.findMany({
      include: {
        user: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      where: {
        businessId,
        status: BusinessMemberStatus.ACTIVE,
      },
    });

    return members.map((member) => this.toBusinessMemberSummary(member));
  }

  async addExistingUserMember(
    businessId: string,
    dto: AddBusinessMemberDto,
    invitedById: string,
  ): Promise<BusinessMemberSummary> {
    const role = dto.role ?? BusinessRole.VIEWER;

    if (role === BusinessRole.OWNER) {
      throw new ForbiddenException('Owner transfer is not implemented.');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        email: dto.email.trim().toLowerCase(),
      },
    });

    if (!user) {
      throw new NotFoundException('User must already exist before they can be added.');
    }

    const existingMembership = await this.prisma.businessMember.findUnique({
      where: {
        businessId_userId: {
          businessId,
          userId: user.id,
        },
      },
    });

    if (existingMembership && existingMembership.status === BusinessMemberStatus.ACTIVE) {
      throw new ConflictException('User is already an active member of this business.');
    }

    const member = existingMembership
      ? await this.prisma.businessMember.update({
          data: {
            invitedById,
            role,
            status: BusinessMemberStatus.ACTIVE,
          },
          include: {
            user: {
              select: {
                displayName: true,
                email: true,
              },
            },
          },
          where: { id: existingMembership.id },
        })
      : await this.prisma.businessMember.create({
          data: {
            businessId,
            invitedById,
            role,
            status: BusinessMemberStatus.ACTIVE,
            userId: user.id,
          },
          include: {
            user: {
              select: {
                displayName: true,
                email: true,
              },
            },
          },
        });

    return this.toBusinessMemberSummary(member);
  }

  toBusinessSummary(business: Business): BusinessSummary {
    return {
      createdAt: business.createdAt.toISOString(),
      currency: business.currency,
      id: business.id,
      legalName: business.legalName ?? undefined,
      locale: business.locale,
      name: business.name,
      ownerId: business.ownerId,
      timezone: business.timezone,
      updatedAt: business.updatedAt.toISOString(),
    };
  }

  toBusinessMemberSummary(member: BusinessMember | BusinessMemberWithUser): BusinessMemberSummary {
    return {
      businessId: member.businessId,
      createdAt: member.createdAt.toISOString(),
      displayName: 'user' in member ? (member.user.displayName ?? undefined) : undefined,
      email: 'user' in member ? member.user.email : undefined,
      id: member.id,
      role: member.role,
      status: member.status,
      updatedAt: member.updatedAt.toISOString(),
      userId: member.userId,
    };
  }
}
