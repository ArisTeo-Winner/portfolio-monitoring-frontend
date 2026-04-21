import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  BuyOrSellTransactionPayload,
  UpdateTransactionPayload,
  TransactionResponse,
  TransferTransactionPayload,
} from "@/features/transactions/types/transaction.types";

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function withIdempotencyKey() {
  return {
    "X-Idempotency-Key": createIdempotencyKey(),
  };
}

export function createBuyTransaction(payload: BuyOrSellTransactionPayload) {
  return apiRequest<TransactionResponse>(endpoints.transactions.buy, {
    method: "POST",
    auth: true,
    headers: withIdempotencyKey(),
    body: payload,
  });
}

export function createSellTransaction(payload: BuyOrSellTransactionPayload) {
  return apiRequest<TransactionResponse>(endpoints.transactions.sell, {
    method: "POST",
    auth: true,
    headers: withIdempotencyKey(),
    body: payload,
  });
}

export function createTransferTransaction(payload: TransferTransactionPayload) {
  return apiRequest<TransactionResponse>(endpoints.transactions.transfer, {
    method: "POST",
    auth: true,
    headers: withIdempotencyKey(),
    body: payload,
  });
}

export function updateTransaction(transactionId: string, payload: UpdateTransactionPayload) {
  return apiRequest<TransactionResponse>(endpoints.transactions.byId(transactionId), {
    method: "PUT",
    auth: true,
    headers: withIdempotencyKey(),
    body: payload,
  });
}

export function deleteTransaction(transactionId: string) {
  return apiRequest<void>(endpoints.transactions.byId(transactionId), {
    method: "DELETE",
    auth: true,
    headers: withIdempotencyKey(),
  });
}
