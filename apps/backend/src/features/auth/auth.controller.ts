import { Body, Controller, Get, Inject, Ip, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from './decorators/current-user.decorator';
// DTO classes must stay as value imports so Nest validation metadata is emitted.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LoginDto } from './dto/login.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LogoutDto } from './dto/logout.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RefreshTokenDto } from './dto/refresh-token.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './types/auth.types';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Ip() ipAddress: string, @Req() request: Request) {
    return this.authService.register(dto, {
      ipAddress,
      userAgent: request.get('user-agent'),
    });
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ipAddress: string, @Req() request: Request) {
    return this.authService.login(dto, {
      ipAddress,
      userAgent: request.get('user-agent'),
    });
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Ip() ipAddress: string, @Req() request: Request) {
    return this.authService.refresh(dto.refreshToken, {
      ipAddress,
      userAgent: request.get('user-agent'),
    });
  }

  @Post('logout')
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getCurrentUser(user.userId);
  }
}
