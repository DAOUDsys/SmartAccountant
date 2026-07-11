import { IsEnum, IsISO8601, IsOptional, IsString, Length } from 'class-validator';

export enum PostingSource {
  IMPORT = 'IMPORT',
  MANUAL = 'MANUAL',
  SYSTEM_RETRY = 'SYSTEM_RETRY',
}

export class PostTransactionDto {
  @IsString()
  @Length(1, 160)
  idempotencyKey!: string;

  @IsOptional()
  @IsISO8601()
  postingDate?: string;

  @IsOptional()
  @IsEnum(PostingSource)
  source?: PostingSource;
}
