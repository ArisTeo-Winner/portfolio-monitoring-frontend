import { computePortfolioTotals, encodeBmvSymbol, formatPortfolioTotal, getAssetCurrency } from "../currency";

describe("getAssetCurrency", () => {
  it("treats a trailing '*' as MXN (BMV convention)", () => {
    expect(getAssetCurrency("AAPL*")).toBe("MXN");
  });

  it("treats a symbol without '*' as USD", () => {
    expect(getAssetCurrency("AAPL")).toBe("USD");
  });
});

describe("encodeBmvSymbol", () => {
  it("percent-encodes the trailing asterisk as %2A", () => {
    expect(encodeBmvSymbol("AAPL*")).toBe("AAPL%2A");
  });

  it("leaves a plain symbol untouched", () => {
    expect(encodeBmvSymbol("AAPL")).toBe("AAPL");
  });
});

describe("computePortfolioTotals", () => {
  it("converts MXN positions to USD using the live rate instead of summing raw values", () => {
    const entries = [
      { assetSymbol: "AAPL*", currentValue: 5992 }, // MXN
      { assetSymbol: "MSFT", currentValue: 104 }, // USD
    ];

    const totals = computePortfolioTotals(entries, 17.5);

    expect(totals.combined).toBe(true);
    expect(totals.totalUsd).toBeCloseTo(104 + 5992 / 17.5, 5);
    expect(totals.totalUsd).not.toBeCloseTo(6096, 0);
  });

  it("falls back to separate per-currency subtotals when the rate is unavailable", () => {
    const entries = [
      { assetSymbol: "AAPL*", currentValue: 5992 },
      { assetSymbol: "MSFT", currentValue: 104 },
    ];

    const totals = computePortfolioTotals(entries, null);

    expect(totals.combined).toBe(false);
    expect(totals.totalUsd).toBe(104);
    expect(totals.totalMxn).toBe(5992);
  });

  it("treats a rate of 0 or negative as unavailable", () => {
    const entries = [{ assetSymbol: "AAPL*", currentValue: 100 }];
    expect(computePortfolioTotals(entries, 0).combined).toBe(false);
    expect(computePortfolioTotals(entries, -5).combined).toBe(false);
  });
});

describe("formatPortfolioTotal", () => {
  it("renders a single USD figure when totals are combined", () => {
    expect(formatPortfolioTotal({ combined: true, totalUsd: 446.4, totalMxn: 7812 })).toBe("$446.40");
  });

  it("renders separate USD + MXN subtotals when not combined, instead of one mixed figure", () => {
    const label = formatPortfolioTotal({ combined: false, totalUsd: 104, totalMxn: 5992 });
    expect(label).toBe("$104.00 + $5,992.00");
    // The two subtotals must stay separate — never collapsed into a single raw sum.
    expect(label).not.toContain("6,096.00");
  });

  it("omits a zero-value currency subtotal in the fallback path", () => {
    const label = formatPortfolioTotal({ combined: false, totalUsd: 0, totalMxn: 5992 });
    expect(label).not.toContain("$0.00");
  });
});
