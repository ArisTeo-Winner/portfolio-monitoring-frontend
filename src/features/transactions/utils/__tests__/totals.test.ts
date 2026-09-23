import { buildFeePayload, calculateBuyTotal, calculateSellTotal, resolveEffectiveFee } from "../totals";

describe("calculateBuyTotal", () => {
  it("returns quantity × price when fee is omitted", () => {
    expect(calculateBuyTotal(2, 30000)).toBe(60000);
  });

  it("adds the fee to the total", () => {
    expect(calculateBuyTotal(1, 1000, 5)).toBe(1005);
  });

  it("handles fractional quantities", () => {
    expect(calculateBuyTotal(0.5, 60000, 0)).toBe(30000);
  });

  it("returns 0 for zero quantity", () => {
    expect(calculateBuyTotal(0, 1000, 10)).toBe(10);
  });

  it("handles a fee of 0 explicitly", () => {
    expect(calculateBuyTotal(3, 500, 0)).toBe(1500);
  });
});

describe("calculateSellTotal", () => {
  it("returns quantity × price when fee is omitted", () => {
    expect(calculateSellTotal(2, 30000)).toBe(60000);
  });

  it("subtracts the fee from the total", () => {
    expect(calculateSellTotal(1, 1000, 5)).toBe(995);
  });

  it("handles fractional quantities", () => {
    expect(calculateSellTotal(0.5, 60000, 100)).toBe(29900);
  });

  it("can produce a negative result when fee > proceeds", () => {
    expect(calculateSellTotal(1, 5, 10)).toBe(-5);
  });
});

describe("resolveEffectiveFee", () => {
  it("sums commission + IVA in split mode", () => {
    expect(resolveEffectiveFee(true, 8.5, 1.36, 0)).toBeCloseTo(9.86, 10);
  });

  it("uses the single fee when split is off", () => {
    expect(resolveEffectiveFee(false, 8.5, 1.36, 5)).toBe(5);
  });
});

describe("buildFeePayload — ADR-0005 mutual exclusivity", () => {
  it("sends the split (no fee) when commission or IVA is entered", () => {
    expect(buildFeePayload(true, 10, 1.6, 0)).toEqual({ brokerCommission: 10, brokerIva: 1.6 });
    expect(buildFeePayload(true, 5, 0, 0)).toEqual({ brokerCommission: 5, brokerIva: 0 });
  });

  it("WETO golden: USA sin IVA → split { 0.10, 0 }, sin fee", () => {
    expect(buildFeePayload(true, 0.1, 0, 0)).toEqual({ brokerCommission: 0.1, brokerIva: 0 });
  });

  it("falls back to the single fee when split is active but nothing entered", () => {
    expect(buildFeePayload(true, 0, 0, 3)).toEqual({ fee: 3 });
  });

  it("omits the fee (undefined) when it is 0 and there is no split", () => {
    expect(buildFeePayload(false, 0, 0, 0)).toEqual({ fee: undefined });
  });

  it("uses the single fee path entirely when split is off", () => {
    expect(buildFeePayload(false, 10, 5, 7)).toEqual({ fee: 7 });
  });
});
