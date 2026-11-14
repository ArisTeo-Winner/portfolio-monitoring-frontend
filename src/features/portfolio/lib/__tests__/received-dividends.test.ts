import { describe, expect, it } from "vitest";
import { summarizeReceivedByCurrency } from "@/features/portfolio/lib/received-dividends";
import type { ReceivedDividend } from "@/features/portfolio/types/received-dividend.types";

function row(partial: Partial<ReceivedDividend> & { currency: string; netAmount: number; grossAmount: number }): ReceivedDividend {
  return {
    symbol: "X",
    assetName: null,
    logoUrl: null,
    exDate: null,
    paymentDate: "2026-06-15T04:00:00Z",
    shares: 1,
    amountPerShare: partial.amountPerShare ?? 0,
    type: "CASH",
    taxWithheld: 0,
    ...partial,
  };
}

describe("summarizeReceivedByCurrency", () => {
  it("returns an empty array for no rows", () => {
    expect(summarizeReceivedByCurrency([])).toEqual([]);
  });

  it("sums net and gross per currency without crossing currencies", () => {
    const totals = summarizeReceivedByCurrency([
      row({ currency: "USD", grossAmount: 0.2, netAmount: 0.2 }),
      row({ currency: "USD", grossAmount: 1.0, netAmount: 0.85 }),
      row({ currency: "MXN", grossAmount: 2.3, netAmount: 2.0 }),
    ]);

    expect(totals).toHaveLength(2);
    const usd = totals.find((t) => t.currency === "USD")!;
    const mxn = totals.find((t) => t.currency === "MXN")!;
    expect(usd.gross).toBeCloseTo(1.2);
    expect(usd.net).toBeCloseTo(1.05);
    expect(usd.count).toBe(2);
    expect(mxn.net).toBeCloseTo(2.0);
    expect(mxn.count).toBe(1);
  });

  it("orders by net total desc, then by currency name", () => {
    const totals = summarizeReceivedByCurrency([
      row({ currency: "MXN", grossAmount: 5, netAmount: 5 }),
      row({ currency: "USD", grossAmount: 10, netAmount: 10 }),
      row({ currency: "EUR", grossAmount: 10, netAmount: 10 }),
    ]);
    // USD and EUR tie on net (10) → alphabetical; MXN (5) last.
    expect(totals.map((t) => t.currency)).toEqual(["EUR", "USD", "MXN"]);
  });
});
