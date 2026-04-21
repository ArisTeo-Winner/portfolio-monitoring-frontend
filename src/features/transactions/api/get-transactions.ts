import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import {
  normalizeTransactionAssetType,
  normalizeTransactionResponse,
  type RawTransactionResponse,
} from "@/features/transactions/lib/normalize-transaction-response";
import type { TransactionDetailsResponse, TransactionResponse } from "@/features/transactions/types/transaction.types";

type TransactionFilters = {
  assetSymbol?: string;
  assetType?: string;
  transactionType?: string;
};

export async function getUserTransactions(filters: TransactionFilters = {}) {
  const params = new URLSearchParams();

  if (filters.assetSymbol) params.set("assetSymbol", filters.assetSymbol);
  if (filters.transactionType) params.set("transactionType", filters.transactionType);

  const query = params.toString();
  const endpoint = query ? `${endpoints.transactions.me}?${query}` : endpoints.transactions.me;
  const data = await apiRequest<TransactionResponse[]>(endpoint, { auth: true });
  const normalizedData = data.map((transaction) => normalizeTransactionResponse(transaction as RawTransactionResponse));

  if (filters.assetType) {
    const normalizedFilter = normalizeTransactionAssetType(filters.assetType, filters.assetSymbol ?? "");
    return normalizedData.filter(
      (transaction) => normalizeTransactionAssetType(transaction.assetType, transaction.assetSymbol) === normalizedFilter,
    );
  }

  return normalizedData;
}

export async function getTransactionDetails(transactionId: string) {
  return apiRequest<TransactionDetailsResponse>(endpoints.transactions.details(transactionId), {
    auth: true,
  });
}
