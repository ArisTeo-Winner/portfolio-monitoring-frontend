import type { TransactionResponse } from "@/features/transactions/types/transaction.types";

const KNOWN_STOCKS = ["MSFT", "AAPL", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "CRCL"];
const KNOWN_INDICES = ["SPY", "QQQ", "DIA"];

export type RawTransactionResponse = TransactionResponse & {
  id?: string;
  transaction_id?: string;
};

export function normalizeTransactionAssetType(assetType: string, assetSymbol: string) {
  const symbol = assetSymbol.toUpperCase();
  const normalized = assetType.toUpperCase();

  if (KNOWN_STOCKS.includes(symbol)) {
    return "STOCK";
  }

  if (KNOWN_INDICES.includes(symbol)) {
    return "INDEX";
  }

  if (normalized === "STOCKS") {
    return "STOCK";
  }

  return normalized;
}

export function normalizeTransactionResponse(raw: RawTransactionResponse): TransactionResponse {
  return {
    ...raw,
    transactionId: raw.transactionId ?? raw.transaction_id ?? raw.id ?? "",
    assetType: normalizeTransactionAssetType(raw.assetType, raw.assetSymbol),
  };
}
