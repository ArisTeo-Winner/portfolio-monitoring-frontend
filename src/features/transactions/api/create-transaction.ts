import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  BuyOrSellTransactionPayload,
  RegisterDividendPayload,
  UpdateTransactionPayload,
  TransactionResponse,
  TransferTransactionPayload,
} from "@/features/transactions/types/transaction.types";

function toOffsetDateTime(localDateTimeInput: string): string {
  const date = new Date(localDateTimeInput);
  const offsetMinutes = date.getTimezoneOffset();
  const sign = offsetMinutes <= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${localDateTimeInput}:00${sign}${hh}:${mm}`;
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Idempotency-Key: callers that may retry the SAME submit attempt (e.g. a form
// that retries after a failed request) should pass their own pre-generated
// key so retries reuse it instead of minting a new one each call — otherwise
// the backend's idempotency protection never kicks in. When omitted, a fresh
// key is generated (single-shot callers, e.g. programmatic/test usage).
function withIdempotencyKey(idempotencyKey?: string) {
  return {
    "X-Idempotency-Key": idempotencyKey ?? createIdempotencyKey(),
  };
}

export function createBuyTransaction(payload: BuyOrSellTransactionPayload, idempotencyKey?: string) {
  return apiRequest<TransactionResponse>(endpoints.transactions.buy, {
    method: "POST",
    auth: true,
    headers: withIdempotencyKey(idempotencyKey),
    body: { ...payload, transactionDate: toOffsetDateTime(payload.transactionDate) },
  });
}

export function createSellTransaction(payload: BuyOrSellTransactionPayload, idempotencyKey?: string) {
  return apiRequest<TransactionResponse>(endpoints.transactions.sell, {
    method: "POST",
    auth: true,
    headers: withIdempotencyKey(idempotencyKey),
    body: { ...payload, transactionDate: toOffsetDateTime(payload.transactionDate) },
  });
}

export function createTransferTransaction(payload: TransferTransactionPayload, idempotencyKey?: string) {
  return apiRequest<TransactionResponse>(endpoints.transactions.transfer, {
    method: "POST",
    auth: true,
    headers: withIdempotencyKey(idempotencyKey),
    body: { ...payload, transactionDate: toOffsetDateTime(payload.transactionDate) },
  });
}

export function registerDividend(payload: RegisterDividendPayload, idempotencyKey?: string) {
  return apiRequest<TransactionResponse>(endpoints.transactions.dividend, {
    method: "POST",
    auth: true,
    headers: withIdempotencyKey(idempotencyKey),
    body: { ...payload, transactionDate: toOffsetDateTime(payload.transactionDate) },
  });
}

export function updateTransaction(transactionId: string, payload: UpdateTransactionPayload) {
  return apiRequest<TransactionResponse>(endpoints.transactions.byId(transactionId), {
    method: "PUT",
    auth: true,
    headers: withIdempotencyKey(),
    body: { ...payload, transactionDate: toOffsetDateTime(payload.transactionDate) },
  });
}

export function deleteTransaction(transactionId: string) {
  return apiRequest<void>(endpoints.transactions.byId(transactionId), {
    method: "DELETE",
    auth: true,
    headers: withIdempotencyKey(),
  });
}
