import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  BusinessMemberStatus,
  BusinessRole,
  type Business,
  type BusinessMember,
  type User,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { createDefaultAccountsForBusiness } from '../accounts';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type {
  AuthBusiness,
  AuthBusinessContext,
  AuthBusinessMembership,
  AuthResponse,
  AuthTokens,
  SafeUser,
} from './types/auth.types';

interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

interface JwtPayload {
  email: string;
  role: User['role'];
  sub: string;
}

const durationPattern = /^(\d+)([smhd])$/;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashRefreshToken(refreshToken: string) {
  return createHash('sha256').update(refreshToken).digest('hex');
}

function parseDurationSeconds(value: string) {
  const match = durationPattern.exec(value.trim());

  if (!match) {
    throw new Error(`Invalid duration value: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2] as 'd' | 'h' | 'm' | 's';
  const multipliers: Record<typeof unit, number> = {
    d: 86_400,
    h: 3_600,
    m: 60,
    s: 1,
  };

  return amount * multipliers[unit];
}

function addSeconds(date: Date, seconds: number) {
  return new Date(date.getTime() + seconds * 1_000);
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService,
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto, metadata: RequestMetadata): Promise<AuthResponse> {
    const email = normalizeEmail(dto.email);
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.getBcryptRounds());

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          displayName: dto.displayName?.trim() || undefined,
          email,
          passwordHash,
        },
      });
      const business = await tx.business.create({
        data: {
          name: this.getDefaultBusinessName(user.displayName),
          ownerId: user.id,
        },
      });
      await createDefaultAccountsForBusiness(tx, business.id);
      const membership = await tx.businessMember.create({
        data: {
          businessId: business.id,
          role: BusinessRole.OWNER,
          status: BusinessMemberStatus.ACTIVE,
          userId: user.id,
        },
      });
      const tokens = await this.issueTokenPair(user, metadata, tx);

      return {
        businessContext: this.toAuthBusinessContext(business, membership),
        tokens,
        user: this.toSafeUser(user),
      };
    });
  }

  async login(dto: LoginDto, metadata: RequestMetadata): Promise<AuthResponse> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const validPassword = await bcrypt.compare(dto.password, user.passwordHash);

    if (!validPassword) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const tokens = await this.issueTokenPair(user, metadata);

    return {
      businessContext: await this.getDefaultBusinessContext(user.id),
      tokens,
      user: this.toSafeUser(user),
    };
  }

  async refresh(refreshToken: string, metadata: RequestMetadata): Promise<AuthResponse> {
    const tokenHash = hashRefreshToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      include: { user: true },
      where: { tokenHash },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date() ||
      storedToken.user.deletedAt
    ) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    await this.prisma.refreshToken.update({
      data: { revokedAt: new Date() },
      where: { id: storedToken.id },
    });

    const tokens = await this.issueTokenPair(storedToken.user, metadata);

    return {
      businessContext: await this.getDefaultBusinessContext(storedToken.user.id),
      tokens,
      user: this.toSafeUser(storedToken.user),
    };
  }

  async logout(refreshToken?: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.updateMany({
        data: { revokedAt: new Date() },
        where: {
          revokedAt: null,
          tokenHash: hashRefreshToken(refreshToken),
        },
      });
    }

    return { success: true };
  }

  async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        id: userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.toSafeUser(user);
  }

  toSafeUser(user: User): SafeUser {
    return {
      createdAt: user.createdAt.toISOString(),
      displayName: user.displayName ?? undefined,
      email: user.email,
      id: user.id,
      role: user.role,
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private toAuthBusiness(business: Business): AuthBusiness {
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

  private toAuthBusinessMembership(membership: BusinessMember): AuthBusinessMembership {
    return {
      businessId: membership.businessId,
      createdAt: membership.createdAt.toISOString(),
      id: membership.id,
      role: membership.role,
      status: membership.status,
      updatedAt: membership.updatedAt.toISOString(),
      userId: membership.userId,
    };
  }

  private toAuthBusinessContext(
    business: Business,
    membership: BusinessMember,
  ): AuthBusinessContext {
    return {
      business: this.toAuthBusiness(business),
      membership: this.toAuthBusinessMembership(membership),
    };
  }

  private async getDefaultBusinessContext(
    userId: string,
  ): Promise<AuthBusinessContext | undefined> {
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
      return undefined;
    }

    return this.toAuthBusinessContext(membership.business, membership);
  }

  private getDefaultBusinessName(displayName?: string | null) {
    const name = displayName?.trim();

    return name ? `${name}'s Business` : 'My Business';
  }

  private async issueTokenPair(
    user: User,
    metadata: RequestMetadata,
    prisma: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<AuthTokens> {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresInSeconds = parseDurationSeconds(
      this.configService.getOrThrow<string>('auth.jwtRefreshExpiresIn'),
    );

    await prisma.refreshToken.create({
      data: {
        expiresAt: addSeconds(new Date(), refreshExpiresInSeconds),
        ipAddress: metadata.ipAddress,
        tokenHash: hashRefreshToken(refreshToken),
        userAgent: metadata.userAgent,
        userId: user.id,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private signAccessToken(user: User) {
    const payload: JwtPayload = {
      email: user.email,
      role: user.role,
      sub: user.id,
    };
    const expiresIn = parseDurationSeconds(
      this.configService.getOrThrow<string>('auth.jwtAccessExpiresIn'),
    );

    return this.jwtService.signAsync(payload, {
      expiresIn,
      secret: this.configService.getOrThrow<string>('auth.jwtAccessSecret'),
    });
  }

  private getBcryptRounds() {
    return this.configService.getOrThrow<number>('auth.bcryptRounds');
  }
}

export const authTestUtils = {
  hashRefreshToken,
  normalizeEmail,
  parseDurationSeconds,
};
