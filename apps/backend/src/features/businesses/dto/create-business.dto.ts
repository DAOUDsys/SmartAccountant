import { IsOptional, IsString, Length } from 'class-validator';

export class CreateBusinessDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  legalName?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsString()
  @Length(2, 12)
  locale?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  timezone?: string;
}
