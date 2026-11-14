import { describe, expect, it } from "vitest";
import {
  computeDividendYield,
  groupIncomeByCurrency,
  resolveDividendYield,
} from "@/features/portfolio/lib/dividends-currency";

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

describe("computeDividendYield", () => {
  it("computes income / value when currencies match", () => {
    expect(computeDividendYield(1.83, 408.22, "USD", "USD")).toBeCloseTo(0.004483, 5);
  });

  it("returns null when the dividend and value currencies differ (needs FX)", () => {
    // BIMBOA pays in MXN but the value is shown in USD → no honest front-only yield.
    expect(computeDividendYield(0.87, 54.49, "MXN", "USD")).toBeNull();
  });

  it("returns null for a non-payer or a zero/negative value", () => {
    expect(computeDividendYield(0, 100, "USD", "USD")).toBeNull();
    expect(computeDividendYield(5, 0, "USD", "USD")).toBeNull();
  });
});

describe("resolveDividendYield (ADR-0031)", () => {
  it("uses the backend yieldPct when provided, even across currencies", () => {
    // NVDA pays USD but value shown in MXN: local calc would be null, but the
    // backend yield (native USD) is authoritative and must be shown as-is.
    expect(resolveDividendYield(0.036667, 100, 50_000, "USD", "MXN")).toBe(0.036667);
  });

  it("passes through an explicit backend null (no history / no price) as N/D", () => {
    // Even though the local same-currency calc could produce a number here, an
    // explicit null from the backend wins — we never fabricate a fallback yield.
    expect(resolveDividendYield(null, 1.83, 408.22, "USD", "USD")).toBeNull();
  });

  it("falls back to the local same-currency calc when the field is absent (pre-deploy backend)", () => {
    expect(resolveDividendYield(undefined, 1.83, 408.22, "USD", "USD")).toBeCloseTo(0.004483, 5);
  });

  it("fallback still returns null for a cross-currency pair when the backend field is absent", () => {
    expect(resolveDividendYield(undefined, 0.87, 54.49, "MXN", "USD")).toBeNull();
  });
});
