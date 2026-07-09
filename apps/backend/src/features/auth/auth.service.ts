import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { AuthResponse, AuthTokens, SafeUser } from './types/auth.types';

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
    const user = await this.prisma.user.create({
      data: {
        displayName: dto.displayName?.trim() || undefined,
        email,
        passwordHash,
      },
    });
    const tokens = await this.issueTokenPair(user, metadata);

    return {
      tokens,
      user: this.toSafeUser(user),
    };
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

  private async issueTokenPair(user: User, metadata: RequestMetadata): Promise<AuthTokens> {
    const accessToken = await this.signAccessToken(user);
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresInSeconds = parseDurationSeconds(
      this.configService.getOrThrow<string>('auth.jwtRefreshExpiresIn'),
    );

    await this.prisma.refreshToken.create({
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
