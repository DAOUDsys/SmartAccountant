import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

export class AdjustmentLineDto {
  @IsString()
  accountId!: string;

  @IsOptional()
  @IsNumberString()
  debitAmount?: string;

  @IsOptional()
  @IsNumberString()
  creditAmount?: string;

  @IsOptional()
  @IsString()
  @Length(1, 240)
  description?: string;
}

export class ReplaceAdjustmentLinesDto {
  @IsString()
  @Length(1, 500)
  description!: string;

  @IsString()
  @Length(1, 1000)
  reason!: string;

  @IsISO8601()
  postingDate!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => AdjustmentLineDto)
  lines!: AdjustmentLineDto[];
}
