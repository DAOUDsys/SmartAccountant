import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { JournalEntryStatus } from '@prisma/client';

export class CreateJournalDraftLineDto {
  @IsString()
  @Length(1, 80)
  accountId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  debitAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditAmount?: number;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  description?: string;
}

export class CreateJournalDraftDto {
  @IsISO8601()
  postingDate!: string;

  @IsString()
  @Length(1, 1000)
  description!: string;

  @IsString()
  @Length(1, 160)
  idempotencyKey!: string;

  @IsOptional()
  @IsEnum(JournalEntryStatus)
  status?: JournalEntryStatus;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  sourceTransactionId?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateJournalDraftLineDto)
  lines!: CreateJournalDraftLineDto[];
}
