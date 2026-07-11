import { BusinessRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';

export class AddBusinessMemberDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsEnum(BusinessRole)
  role?: BusinessRole;
}
