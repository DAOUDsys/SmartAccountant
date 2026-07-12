import { IsISO8601, IsString, Length } from 'class-validator';

export class ReversalPreviewDto {
  @IsString()
  @Length(1, 1000)
  reason!: string;

  @IsISO8601()
  reversalDate!: string;
}
