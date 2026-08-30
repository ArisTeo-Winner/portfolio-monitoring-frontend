import { calculateBuyTotal, calculateSellTotal } from "../totals";

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
