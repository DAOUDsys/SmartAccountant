import { IsEnum, IsISO8601, IsOptional, IsString, Length } from 'class-validator';

export enum ReversalSource {
  IMPORT = 'IMPORT',
  MANUAL = 'MANUAL',
  SYSTEM_RETRY = 'SYSTEM_RETRY',
}

export class ReverseTransactionDto {
  @IsString()
  @Length(1, 1000)
  reason!: string;

  @IsISO8601()
  reversalDate!: string;

  @IsString()
  @Length(1, 160)
  idempotencyKey!: string;

  @IsOptional()
  @IsEnum(ReversalSource)
  source?: ReversalSource;
}
