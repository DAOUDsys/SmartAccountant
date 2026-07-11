import { IsString, Length } from 'class-validator';

export class UpdateAccountMappingDto {
  @IsString()
  @Length(1, 80)
  accountId!: string;
}
