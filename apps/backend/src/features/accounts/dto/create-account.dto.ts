import { AccountType, NormalBalance } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @Length(1, 40)
  code!: string;

  @IsString()
  @Length(1, 160)
  name!: string;

  @IsEnum(AccountType)
  type!: AccountType;

  @IsOptional()
  @IsEnum(NormalBalance)
  normalBalance?: NormalBalance;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
