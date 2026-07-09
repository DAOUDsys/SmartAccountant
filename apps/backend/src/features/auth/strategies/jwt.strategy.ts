import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../types/auth.types';

interface AccessTokenPayload {
  email: string;
  role: AuthenticatedUser['role'];
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(@Inject(ConfigService) configService: ConfigService) {
    super({
      ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow<string>('auth.jwtAccessSecret'),
    });
  }

  validate(payload: AccessTokenPayload): AuthenticatedUser {
    return {
      email: payload.email,
      role: payload.role,
      userId: payload.sub,
    };
  }
}
