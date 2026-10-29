import { describe, it, expect } from "vitest";
import { selectImportedTransactions } from "@/features/import/lib/select-imported-transactions";
import type { ImportJob } from "@/features/import/types/import.types";
import type { TransactionResponse } from "@/features/transactions/types/transaction.types";

function job(overrides: Partial<ImportJob> = {}): ImportJob {
  return {
    jobId: "j1",
    fileName: "dw.pdf",
    jobType: "DRIVEWEALTH_CONFIRMATION",
    status: "COMPLETED",
    result: { fileName: "dw.pdf", accepted: 2, duplicate: 0, skipped: 0, rejected: 0, messages: [] },
    errorMessage: null,
    attemptCount: 0,
    createdAt: "2026-08-22T10:00:00Z",
    completedAt: "2026-08-22T10:00:30Z",
    ...overrides,
  };
}

function tx(overrides: Partial<TransactionResponse> = {}): TransactionResponse {
  return {
    transactionId: "t1",
    assetSymbol: "AAPL",
    assetType: "STOCK",
    transactionType: "BUY",
    quantity: 1.5,
    pricePerUnit: 200,
    totalValue: 300,
    transactionDate: "2026-08-19T00:00:00Z",
    fee: 0,
    createdAt: "2026-08-22T10:00:10Z",
    updatedAt: "2026-08-22T10:00:10Z",
    broker: "DriveWealth",
    currency: "USD",
    ...overrides,
  };
}

describe("selectImportedTransactions", () => {
  it("keeps rows matching broker + currency inside the job window, newest first", () => {
    const rows = [
      tx({ transactionId: "a", createdAt: "2026-08-22T10:00:05Z" }),
      tx({ transactionId: "b", createdAt: "2026-08-22T10:00:20Z" }),
    ];
    const result = selectImportedTransactions(rows, job());
    expect(result.map((r) => r.transactionId)).toEqual(["b", "a"]);
  });

  it("excludes a different broker", () => {
    const rows = [tx({ transactionId: "x", broker: "IBKR" })];
    expect(selectImportedTransactions(rows, job())).toHaveLength(0);
  });

  it("excludes a different currency", () => {
    const rows = [tx({ transactionId: "x", currency: "MXN" })];
    expect(selectImportedTransactions(rows, job())).toHaveLength(0);
  });

  it("excludes rows created outside the job window", () => {
    const rows = [
      tx({ transactionId: "before", createdAt: "2026-08-22T09:59:00Z" }),
      tx({ transactionId: "after", createdAt: "2026-08-22T10:05:00Z" }),
    ];
    expect(selectImportedTransactions(rows, job())).toHaveLength(0);
  });

  it("keeps the window open to `now` when completedAt is null", () => {
    const now = Date.parse("2026-08-22T10:10:00Z");
    const rows = [tx({ transactionId: "late", createdAt: "2026-08-22T10:08:00Z" })];
    const result = selectImportedTransactions(rows, job({ completedAt: null }), now);
    expect(result.map((r) => r.transactionId)).toEqual(["late"]);
  });

  it("returns nothing for an unrecognized jobType", () => {
    expect(selectImportedTransactions([tx()], job({ jobType: "SOMETHING_ELSE" }))).toHaveLength(0);
  });

  it("tolerates rows missing broker/currency", () => {
    const rows = [tx({ transactionId: "n", broker: null, currency: null })];
    expect(selectImportedTransactions(rows, job())).toHaveLength(0);
  });
});
