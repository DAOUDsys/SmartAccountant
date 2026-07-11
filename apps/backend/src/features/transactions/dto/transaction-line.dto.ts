import { IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class TransactionLineDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @Length(1, 240)
  description!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @Min(0)
  totalAmount!: number;
}
