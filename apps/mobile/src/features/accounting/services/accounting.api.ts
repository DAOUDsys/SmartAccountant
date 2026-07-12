import type {
  Account,
  AccountMapping,
  AdjustmentLine,
  AdjustmentPreview,
  Customer,
  JournalEntry,
  PostTransactionRequest,
  PostTransactionResult,
  PostingPreview,
  Product,
  ReplaceAdjustmentLinesRequest,
  ReverseTransactionRequest,
  ReverseTransactionResult,
  ReversalPreview,
  ReversalPreviewRequest,
  Supplier,
  Transaction,
} from '../types/accounting.types';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

interface ApiErrorBody {
  message?: string | string[];
}

async function request<T>(
  path: string,
  accessToken: string,
  options: { body?: unknown; method?: 'GET' | 'POST' | 'PUT' } = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    method: options.method ?? 'GET',
  });

  if (!response.ok) {
    let errorMessage = 'Accounting request failed.';

    try {
      const errorBody = (await response.json()) as ApiErrorBody;
      const message = errorBody.message;
      errorMessage = Array.isArray(message) ? message.join(' ') : message || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }

    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}

export const accountingApi = {
  accountMappings(accessToken: string, businessId: string) {
    return request<AccountMapping[]>(`/businesses/${businessId}/account-mappings`, accessToken);
  },

  adjustmentLines(accessToken: string, businessId: string, transactionId: string) {
    return request<AdjustmentLine[]>(
      `/businesses/${businessId}/transactions/${transactionId}/adjustment-lines`,
      accessToken,
    );
  },

  adjustmentPreview(accessToken: string, businessId: string, transactionId: string) {
    return request<AdjustmentPreview>(
      `/businesses/${businessId}/transactions/${transactionId}/adjustment-preview`,
      accessToken,
      { method: 'POST' },
    );
  },

  accounts(accessToken: string, businessId: string) {
    return request<Account[]>(`/businesses/${businessId}/accounts`, accessToken);
  },

  customers(accessToken: string, businessId: string) {
    return request<Customer[]>(`/businesses/${businessId}/customers`, accessToken);
  },

  journalEntries(accessToken: string, businessId: string) {
    return request<JournalEntry[]>(`/businesses/${businessId}/journal-entries`, accessToken);
  },

  journalEntry(accessToken: string, businessId: string, journalEntryId: string) {
    return request<JournalEntry>(
      `/businesses/${businessId}/journal-entries/${journalEntryId}`,
      accessToken,
    );
  },

  postingPreview(accessToken: string, businessId: string, transactionId: string) {
    return request<PostingPreview>(
      `/businesses/${businessId}/transactions/${transactionId}/posting-preview`,
      accessToken,
    );
  },

  postTransaction(
    accessToken: string,
    businessId: string,
    transactionId: string,
    body: PostTransactionRequest,
  ) {
    return request<PostTransactionResult>(
      `/businesses/${businessId}/transactions/${transactionId}/post`,
      accessToken,
      { body, method: 'POST' },
    );
  },

  reversalPreview(
    accessToken: string,
    businessId: string,
    transactionId: string,
    body: ReversalPreviewRequest,
  ) {
    return request<ReversalPreview>(
      `/businesses/${businessId}/transactions/${transactionId}/reversal-preview`,
      accessToken,
      { body, method: 'POST' },
    );
  },

  reverseTransaction(
    accessToken: string,
    businessId: string,
    transactionId: string,
    body: ReverseTransactionRequest,
  ) {
    return request<ReverseTransactionResult>(
      `/businesses/${businessId}/transactions/${transactionId}/reverse`,
      accessToken,
      { body, method: 'POST' },
    );
  },

  replaceAdjustmentLines(
    accessToken: string,
    businessId: string,
    transactionId: string,
    body: ReplaceAdjustmentLinesRequest,
  ) {
    return request<AdjustmentLine[]>(
      `/businesses/${businessId}/transactions/${transactionId}/adjustment-lines`,
      accessToken,
      { body, method: 'PUT' },
    );
  },

  products(accessToken: string, businessId: string) {
    return request<Product[]>(`/businesses/${businessId}/products`, accessToken);
  },

  suppliers(accessToken: string, businessId: string) {
    return request<Supplier[]>(`/businesses/${businessId}/suppliers`, accessToken);
  },

  transactions(accessToken: string, businessId: string) {
    return request<Transaction[]>(`/businesses/${businessId}/transactions`, accessToken);
  },
};
