import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountMappingKey,
  AccountType,
  Prisma,
  type Account,
  type AccountMapping,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { getNormalBalanceForAccountType } from './account-defaults';
import type { CreateAccountDto } from './dto/create-account.dto';
import type { UpdateAccountMappingDto } from './dto/update-account-mapping.dto';
import type { UpdateAccountDto } from './dto/update-account.dto';

type AccountWithMappings = Account & {
  accountMappings?: AccountMapping[];
};

type AccountMappingWithAccount = AccountMapping & {
  account: Account;
};

export interface AccountResponse {
  businessId: string;
  code: string;
  createdAt: string;
  description?: string;
  id: string;
  isActive: boolean;
  isSystem: boolean;
  name: string;
  normalBalance: Account['normalBalance'];
  parentId?: string;
  type: Account['type'];
  updatedAt: string;
}

export interface AccountMappingResponse {
  account: AccountResponse;
  accountId: string;
  businessId: string;
  createdAt: string;
  id: string;
  key: AccountMapping['key'];
  updatedAt: string;
}

@Injectable()
export class AccountsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    businessId: string,
    filters: { isActive?: boolean; type?: string },
  ): Promise<AccountResponse[]> {
    const type = this.parseAccountType(filters.type);
    const accounts = await this.prisma.account.findMany({
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
      where: {
        businessId,
        deletedAt: null,
        isActive: filters.isActive,
        type,
      },
    });

    return accounts.map((account) => this.toAccountResponse(account));
  }

  async getById(businessId: string, accountId: string): Promise<AccountResponse> {
    const account = await this.findActiveAccount(businessId, accountId);

    return this.toAccountResponse(account);
  }

  async create(businessId: string, dto: CreateAccountDto): Promise<AccountResponse> {
    await this.verifyParentAccount(businessId, dto.parentId);
    const normalBalance = this.resolveNormalBalance(dto.type, dto.normalBalance);

    try {
      const account = await this.prisma.account.create({
        data: {
          businessId,
          code: dto.code.trim(),
          description: dto.description?.trim() || undefined,
          isActive: dto.isActive ?? true,
          name: dto.name.trim(),
          normalBalance,
          parentId: dto.parentId,
          type: dto.type,
        },
      });

      return this.toAccountResponse(account);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async update(
    businessId: string,
    accountId: string,
    dto: UpdateAccountDto,
  ): Promise<AccountResponse> {
    const existing = await this.findActiveAccount(businessId, accountId);

    if (
      existing.isSystem &&
      ((dto.code && dto.code.trim() !== existing.code) ||
        (dto.type && dto.type !== existing.type) ||
        (dto.normalBalance && dto.normalBalance !== existing.normalBalance))
    ) {
      throw new ForbiddenException('System account code, type, and normal balance are protected.');
    }

    if (dto.parentId === accountId) {
      throw new BadRequestException('An account cannot be its own parent.');
    }

    await this.verifyParentAccount(businessId, dto.parentId);

    try {
      const type = dto.type ?? existing.type;
      const account = await this.prisma.account.update({
        data: {
          code: dto.code?.trim(),
          description: dto.description?.trim(),
          isActive: dto.isActive,
          name: dto.name?.trim(),
          normalBalance:
            dto.normalBalance || dto.type
              ? this.resolveNormalBalance(type, dto.normalBalance)
              : undefined,
          parentId: dto.parentId,
          type: dto.type,
        },
        where: { id: accountId },
      });

      return this.toAccountResponse(account);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async softDelete(businessId: string, accountId: string): Promise<AccountResponse> {
    const existing = await this.findActiveAccount(businessId, accountId);

    if (existing.isSystem) {
      throw new ForbiddenException('System accounts cannot be deleted.');
    }

    const account = await this.prisma.account.update({
      data: { deletedAt: new Date(), isActive: false },
      where: { id: accountId },
    });

    return this.toAccountResponse(account);
  }

  async listMappings(businessId: string): Promise<AccountMappingResponse[]> {
    const mappings = await this.prisma.accountMapping.findMany({
      include: { account: true },
      orderBy: { key: 'asc' },
      where: { businessId },
    });

    return mappings
      .filter((mapping) => !mapping.account.deletedAt)
      .map((mapping) => this.toMappingResponse(mapping));
  }

  async updateMapping(
    businessId: string,
    keyValue: string,
    dto: UpdateAccountMappingDto,
  ): Promise<AccountMappingResponse> {
    const key = this.parseMappingKey(keyValue);
    const account = await this.prisma.account.findFirst({
      where: {
        businessId,
        deletedAt: null,
        id: dto.accountId,
        isActive: true,
      },
    });

    if (!account) {
      throw new NotFoundException('Active account not found for this business.');
    }

    const mapping = await this.prisma.accountMapping.upsert({
      create: {
        accountId: account.id,
        businessId,
        key,
      },
      include: { account: true },
      update: {
        accountId: account.id,
      },
      where: {
        businessId_key: {
          businessId,
          key,
        },
      },
    });

    return this.toMappingResponse(mapping);
  }

  private async findActiveAccount(
    businessId: string,
    accountId: string,
  ): Promise<AccountWithMappings> {
    const account = await this.prisma.account.findFirst({
      where: {
        businessId,
        deletedAt: null,
        id: accountId,
      },
    });

    if (!account) {
      throw new NotFoundException('Account not found.');
    }

    return account;
  }

  private async verifyParentAccount(businessId: string, parentId?: string) {
    if (!parentId) {
      return;
    }

    const parent = await this.prisma.account.findFirst({
      where: {
        businessId,
        deletedAt: null,
        id: parentId,
      },
    });

    if (!parent) {
      throw new NotFoundException('Parent account not found for this business.');
    }
  }

  private parseAccountType(type?: string): AccountType | undefined {
    if (!type) {
      return undefined;
    }

    if (!Object.values(AccountType).includes(type as AccountType)) {
      throw new BadRequestException('Unknown account type.');
    }

    return type as AccountType;
  }

  private parseMappingKey(key?: string): AccountMappingKey {
    if (!key || !Object.values(AccountMappingKey).includes(key as AccountMappingKey)) {
      throw new BadRequestException('Unknown account mapping key.');
    }

    return key as AccountMappingKey;
  }

  private resolveNormalBalance(
    type: AccountType,
    normalBalance?: Account['normalBalance'],
  ): Account['normalBalance'] {
    const expectedNormalBalance = getNormalBalanceForAccountType(type);

    if (normalBalance && normalBalance !== expectedNormalBalance) {
      throw new BadRequestException('Normal balance must match the selected account type.');
    }

    return normalBalance ?? expectedNormalBalance;
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Account code already exists for this business.');
    }

    throw error;
  }

  private toAccountResponse(account: Account): AccountResponse {
    return {
      businessId: account.businessId,
      code: account.code,
      createdAt: account.createdAt.toISOString(),
      description: account.description ?? undefined,
      id: account.id,
      isActive: account.isActive,
      isSystem: account.isSystem,
      name: account.name,
      normalBalance: account.normalBalance,
      parentId: account.parentId ?? undefined,
      type: account.type,
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  private toMappingResponse(mapping: AccountMappingWithAccount): AccountMappingResponse {
    return {
      account: this.toAccountResponse(mapping.account),
      accountId: mapping.accountId,
      businessId: mapping.businessId,
      createdAt: mapping.createdAt.toISOString(),
      id: mapping.id,
      key: mapping.key,
      updatedAt: mapping.updatedAt.toISOString(),
    };
  }
}
