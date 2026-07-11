import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessMembershipGuard } from '../businesses';
import { RequireBusinessPermission } from '../businesses/decorators/require-business-permission.decorator';
import { AccountsService } from './accounts.service';
// DTO classes must stay as value imports so Nest validation metadata is emitted.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateAccountDto } from './dto/create-account.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateAccountMappingDto } from './dto/update-account-mapping.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateAccountDto } from './dto/update-account.dto';

@Controller('businesses/:businessId')
@UseGuards(JwtAuthGuard, BusinessMembershipGuard)
export class AccountsController {
  constructor(@Inject(AccountsService) private readonly accountsService: AccountsService) {}

  @Get('accounts')
  @RequireBusinessPermission('accounts.read')
  list(
    @Param('businessId') businessId: string,
    @Query('type') type?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.accountsService.list(businessId, {
      isActive: parseBooleanQuery(isActive),
      type,
    });
  }

  @Get('accounts/:accountId')
  @RequireBusinessPermission('accounts.read')
  getById(@Param('businessId') businessId: string, @Param('accountId') accountId: string) {
    return this.accountsService.getById(businessId, accountId);
  }

  @Post('accounts')
  @RequireBusinessPermission('accounts.manage')
  create(@Param('businessId') businessId: string, @Body() dto: CreateAccountDto) {
    return this.accountsService.create(businessId, dto);
  }

  @Patch('accounts/:accountId')
  @RequireBusinessPermission('accounts.manage')
  update(
    @Param('businessId') businessId: string,
    @Param('accountId') accountId: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.update(businessId, accountId, dto);
  }

  @Delete('accounts/:accountId')
  @RequireBusinessPermission('accounts.manage')
  softDelete(@Param('businessId') businessId: string, @Param('accountId') accountId: string) {
    return this.accountsService.softDelete(businessId, accountId);
  }

  @Get('account-mappings')
  @RequireBusinessPermission('accountMappings.read')
  listMappings(@Param('businessId') businessId: string) {
    return this.accountsService.listMappings(businessId);
  }

  @Patch('account-mappings/:key')
  @RequireBusinessPermission('accountMappings.manage')
  updateMapping(
    @Param('businessId') businessId: string,
    @Param('key') key: string,
    @Body() dto: UpdateAccountMappingDto,
  ) {
    return this.accountsService.updateMapping(businessId, key, dto);
  }
}

function parseBooleanQuery(value?: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value === 'true';
}
