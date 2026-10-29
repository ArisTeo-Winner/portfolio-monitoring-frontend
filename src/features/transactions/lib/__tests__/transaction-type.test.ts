import { describe, expect, it } from "vitest";
import { normalizeTransactionMode, normalizeTransactionType } from "@/features/transactions/lib/transaction-type";

describe("normalizeTransactionType", () => {
  it("keeps DIVIDEND as its own kind (never falls through to BUY)", () => {
    expect(normalizeTransactionType("DIVIDEND")).toBe("DIVIDEND");
    expect(normalizeTransactionType("dividend")).toBe("DIVIDEND");
  });

  it("maps BUY / SELL / TRANSFER", () => {
    expect(normalizeTransactionType("BUY")).toBe("BUY");
    expect(normalizeTransactionType("SELL")).toBe("SELL");
    expect(normalizeTransactionType("TRANSFER")).toBe("TRANSFER");
  });

  it("defaults unknown types to BUY", () => {
    expect(normalizeTransactionType("SOMETHING_ELSE")).toBe("BUY");
  });
});

describe("normalizeTransactionMode", () => {
  it("maps DIVIDEND to the DIVIDEND editing mode", () => {
    expect(normalizeTransactionMode("DIVIDEND")).toBe("DIVIDEND");
  });

  it("maps the other kinds", () => {
    expect(normalizeTransactionMode("SELL")).toBe("SELL");
    expect(normalizeTransactionMode("TRANSFER")).toBe("TRANSFER");
    expect(normalizeTransactionMode("BUY")).toBe("BUY");
  });
});
