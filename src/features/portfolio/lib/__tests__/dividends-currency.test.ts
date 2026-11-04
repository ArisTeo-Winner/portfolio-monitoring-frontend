import { describe, expect, it } from "vitest";
import { groupIncomeByCurrency } from "@/features/portfolio/lib/dividends-currency";

describe("groupIncomeByCurrency", () => {
  it("returns an empty array for no payers", () => {
    expect(groupIncomeByCurrency([])).toEqual([]);
  });

  it("groups income and counts by native currency without summing across currencies", () => {
    const groups = groupIncomeByCurrency([
      { currency: "USD", annualIncome: 100 },
      { currency: "USD", annualIncome: 50 },
      { currency: "MXN", annualIncome: 2000 },
    ]);

    expect(groups).toHaveLength(2);
    const usd = groups.find((g) => g.currency === "USD")!;
    const mxn = groups.find((g) => g.currency === "MXN")!;
    expect(usd.total).toBe(150);
    expect(usd.count).toBe(2);
    expect(mxn.total).toBe(2000);
    expect(mxn.count).toBe(1);
  });

  it("computes share by number of holdings (sums to 1), not by amount", () => {
    const groups = groupIncomeByCurrency([
      { currency: "USD", annualIncome: 10 },
      { currency: "USD", annualIncome: 10 },
      { currency: "USD", annualIncome: 10 },
      { currency: "MXN", annualIncome: 999_999 },
    ]);

    const usd = groups.find((g) => g.currency === "USD")!;
    const mxn = groups.find((g) => g.currency === "MXN")!;
    expect(usd.share).toBeCloseTo(0.75);
    expect(mxn.share).toBeCloseTo(0.25);
    expect(usd.share + mxn.share).toBeCloseTo(1);
  });

  it("orders by holding count desc, then by currency name", () => {
    const groups = groupIncomeByCurrency([
      { currency: "MXN", annualIncome: 1 },
      { currency: "USD", annualIncome: 1 },
      { currency: "USD", annualIncome: 1 },
      { currency: "EUR", annualIncome: 1 },
    ]);

    expect(groups.map((g) => g.currency)).toEqual(["USD", "EUR", "MXN"]);
  });
});
