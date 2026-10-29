import {
  normalizeTransactionAssetType,
  normalizeTransactionResponse,
} from "../normalize-transaction-response";
import type { RawTransactionResponse } from "../normalize-transaction-response";

describe("normalizeTransactionAssetType", () => {
  it("returns STOCK for known stock symbols regardless of assetType", () => {
    expect(normalizeTransactionAssetType("CRYPTO", "AAPL")).toBe("STOCK");
    expect(normalizeTransactionAssetType("CRYPTO", "MSFT")).toBe("STOCK");
    expect(normalizeTransactionAssetType("CRYPTO", "NVDA")).toBe("STOCK");
  });

  it("is case-insensitive for the symbol lookup", () => {
    expect(normalizeTransactionAssetType("CRYPTO", "aapl")).toBe("STOCK");
  });

  it("returns INDEX for known index symbols", () => {
    expect(normalizeTransactionAssetType("CRYPTO", "SPY")).toBe("INDEX");
    expect(normalizeTransactionAssetType("EQUITY", "QQQ")).toBe("INDEX");
  });

  it("normalizes STOCKS assetType to STOCK", () => {
    expect(normalizeTransactionAssetType("STOCKS", "BTC")).toBe("STOCK");
  });

  it("uppercases and returns the assetType for unknown symbols and types", () => {
    expect(normalizeTransactionAssetType("crypto", "BTC")).toBe("CRYPTO");
    expect(normalizeTransactionAssetType("etf", "BTC")).toBe("ETF");
  });
});

function buildRaw(overrides: Partial<RawTransactionResponse> = {}): RawTransactionResponse {
  return {
    transactionId: "tx-1",
    transactionType: "BUY",
    assetSymbol: "BTC",
    assetType: "CRYPTO",
    quantity: 1,
    pricePerUnit: 60000,
    totalValue: 60000,
    transactionDate: "2024-01-01T00:00:00Z",
    fee: 0,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("normalizeTransactionResponse", () => {
  it("preserves transactionId when already present", () => {
    const raw = buildRaw({ transactionId: "tx-original" });
    expect(normalizeTransactionResponse(raw).transactionId).toBe("tx-original");
  });

  it("falls back to transaction_id when transactionId is missing", () => {
    const raw = buildRaw({ transactionId: undefined, transaction_id: "tx-fallback" });
    expect(normalizeTransactionResponse(raw).transactionId).toBe("tx-fallback");
  });

  it("falls back to id when both transactionId and transaction_id are absent", () => {
    const raw = buildRaw({ transactionId: undefined, transaction_id: undefined, id: "tx-id" });
    expect(normalizeTransactionResponse(raw).transactionId).toBe("tx-id");
  });

  it("uses empty string when no id field is present", () => {
    const raw = buildRaw({ transactionId: undefined, transaction_id: undefined, id: undefined });
    expect(normalizeTransactionResponse(raw).transactionId).toBe("");
  });

  it("normalizes the assetType using normalizeTransactionAssetType", () => {
    const raw = buildRaw({ assetSymbol: "AAPL", assetType: "EQUITY" });
    expect(normalizeTransactionResponse(raw).assetType).toBe("STOCK");
  });

  it("does not mutate the raw input", () => {
    const raw = buildRaw();
    const snapshot = { ...raw };
    normalizeTransactionResponse(raw);
    expect(raw).toEqual(snapshot);
  });
});
