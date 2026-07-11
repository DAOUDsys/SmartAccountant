import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AccountMappingKey, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { buildPostingPreviewLines } from './posting-preview.builder';
import {
  inactiveMappedAccountIssue,
  issue,
  missingMappingIssue,
  wrongMappedAccountTypeIssue,
} from './posting-preview.errors';
import {
  expectedAccountTypesByMappingKey,
  validatePreviewableTransactionStatus,
  validateTransactionIntentAmounts,
} from './posting-preview.validators';
import type {
  AccountMappingLookup,
  AccountMappingWithAccount,
  PostingPreviewIssue,
  PostingPreviewResponse,
  TransactionIntentForPreview,
} from './posting-preview.types';

@Injectable()
export class PostingPreviewService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getPreview(businessId: string, transactionId: string): Promise<PostingPreviewResponse> {
    const transaction = await this.prisma.transaction.findFirst({
      include: { lines: true },
      where: {
        businessId,
        deletedAt: null,
        id: transactionId,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found.');
    }

    const statusErrors = validatePreviewableTransactionStatus(transaction);
    const validationErrors =
      transaction.status === TransactionStatus.DRAFT
        ? [
            ...validateTransactionIntentAmounts(transaction),
            ...(await this.validateRelatedRecordsBelongToBusiness(businessId, transaction)),
          ]
        : [];

    const mappings: AccountMappingLookup =
      transaction.status === TransactionStatus.DRAFT
        ? await this.loadAccountMappings(businessId)
        : {};
    const mappingErrors =
      transaction.status === TransactionStatus.DRAFT
        ? this.validateRequiredAccountMappings(businessId, mappings)
        : [];

    const builtPreview =
      statusErrors.length === 0 && validationErrors.length === 0 && mappingErrors.length === 0
        ? buildPostingPreviewLines(transaction, mappings)
        : {
            errors: [],
            isBalanced: false,
            lines: [],
            mappingsUsed: [],
            totalCredit: '0.00',
            totalDebit: '0.00',
            warnings: [],
          };

    const errors = [...statusErrors, ...validationErrors, ...mappingErrors, ...builtPreview.errors];
    const canPost = errors.length === 0 && builtPreview.isBalanced;

    return {
      businessId: transaction.businessId,
      canPost,
      currency: transaction.currency,
      errors,
      isBalanced: builtPreview.isBalanced,
      lines: builtPreview.lines,
      mappingsUsed: builtPreview.mappingsUsed,
      postingDate: transaction.transactionDate.toISOString(),
      totalCredit: builtPreview.totalCredit,
      totalDebit: builtPreview.totalDebit,
      transactionId: transaction.id,
      transactionStatus: transaction.status,
      transactionType: transaction.type,
      warnings: builtPreview.warnings,
    };
  }

  private async loadAccountMappings(businessId: string): Promise<AccountMappingLookup> {
    const mappings = await this.prisma.accountMapping.findMany({
      include: { account: true },
      where: {
        businessId,
        key: {
          in: Object.values(AccountMappingKey),
        },
      },
    });

    return mappings.reduce<AccountMappingLookup>((lookup, mapping) => {
      lookup[mapping.key] = mapping as AccountMappingWithAccount;
      return lookup;
    }, {});
  }

  private validateRequiredAccountMappings(
    businessId: string,
    mappings: AccountMappingLookup,
  ): PostingPreviewIssue[] {
    return Object.values(AccountMappingKey).flatMap((key) => {
      const mapping = mappings[key];
      const expectedType = expectedAccountTypesByMappingKey[key];

      if (!mapping) {
        return [missingMappingIssue(key)];
      }

      if (
        mapping.businessId !== businessId ||
        mapping.account.businessId !== businessId ||
        !mapping.account.isActive ||
        mapping.account.deletedAt
      ) {
        return [inactiveMappedAccountIssue(key)];
      }

      if (mapping.account.type !== expectedType) {
        return [wrongMappedAccountTypeIssue(key, expectedType, mapping.account.type)];
      }

      return [];
    });
  }

  private async validateRelatedRecordsBelongToBusiness(
    businessId: string,
    transaction: TransactionIntentForPreview,
  ): Promise<PostingPreviewIssue[]> {
    const errors: PostingPreviewIssue[] = [];

    if (transaction.customerId) {
      const customer = await this.prisma.customer.findFirst({
        select: { id: true },
        where: {
          businessId,
          deletedAt: null,
          id: transaction.customerId,
        },
      });

      if (!customer) {
        errors.push(
          issue(
            'CROSS_TENANT_REFERENCE',
            'Customer reference is not available for this business.',
            'customerId',
          ),
        );
      }
    }

    if (transaction.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        select: { id: true },
        where: {
          businessId,
          deletedAt: null,
          id: transaction.supplierId,
        },
      });

      if (!supplier) {
        errors.push(
          issue(
            'CROSS_TENANT_REFERENCE',
            'Supplier reference is not available for this business.',
            'supplierId',
          ),
        );
      }
    }

    const productIds = [
      ...new Set(transaction.lines.map((line) => line.productId).filter(Boolean)),
    ] as string[];

    if (productIds.length > 0) {
      const products = await this.prisma.product.findMany({
        select: { id: true },
        where: {
          businessId,
          deletedAt: null,
          id: { in: productIds },
        },
      });

      if (products.length !== productIds.length) {
        errors.push(
          issue(
            'CROSS_TENANT_REFERENCE',
            'Product reference is not available for this business.',
            'lines.productId',
          ),
        );
      }
    }

    return errors;
  }
}
