import type { TransactionMode } from "@/features/transactions/types/transaction.types";

// The transaction kinds the UI renders (never "ALL", which is only a filter state).
export type NormalizedTransactionType = "BUY" | "SELL" | "TRANSFER" | "DIVIDEND";

// Map a backend transactionType string to a UI kind. DIVIDEND (ADR-0014 F3c,
// auto-generated) must be first-class: falling through to BUY mislabels it and
// double-counts it in the net-quantity balance.
export function normalizeTransactionType(transactionType: string): NormalizedTransactionType {
  const normalized = transactionType.toUpperCase();
  if (normalized === "SELL") return "SELL";
  if (normalized === "TRANSFER") return "TRANSFER";
  if (normalized === "DIVIDEND") return "DIVIDEND";
  return "BUY";
}

// Same mapping, typed as the modal's editing mode.
export function normalizeTransactionMode(transactionType: string): TransactionMode {
  const normalized = transactionType.toUpperCase();
  if (normalized === "SELL") return "SELL";
  if (normalized === "TRANSFER") return "TRANSFER";
  if (normalized === "DIVIDEND") return "DIVIDEND";
  return "BUY";
}
