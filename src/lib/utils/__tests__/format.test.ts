import { formatCurrency, formatMarketPrice, formatQuantity, formatSignedCurrency } from "../format";

describe("formatCurrency", () => {
  it("formats a positive integer as USD", () => {
    expect(formatCurrency(1000)).toBe("$1,000.00");
  });

  it("formats a decimal value with 2 decimal places", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  it("formats zero as $0.00", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats a negative value", () => {
    expect(formatCurrency(-500)).toBe("-$500.00");
  });

  it("accepts a numeric string", () => {
    expect(formatCurrency("2500.75")).toBe("$2,500.75");
  });

  it("returns $0.00 for NaN string input", () => {
    expect(formatCurrency("not-a-number")).toBe("$0.00");
  });
});

describe("formatQuantity", () => {
  it("formats an integer with no decimals", () => {
    expect(formatQuantity(10)).toBe("10");
  });

  it("preserves up to 8 decimal places", () => {
    expect(formatQuantity(0.12345678)).toBe("0.12345678");
  });

  it("accepts a numeric string", () => {
    expect(formatQuantity("5.5")).toBe("5.5");
  });

  it("returns 0 for NaN string input", () => {
    expect(formatQuantity("abc")).toBe("0");
  });
});

describe("formatSignedCurrency", () => {
  it("prefixes a positive value with +", () => {
    expect(formatSignedCurrency(500)).toBe("+$500.00");
  });

  it("prefixes zero with +", () => {
    expect(formatSignedCurrency(0)).toBe("+$0.00");
  });

  it("prefixes a negative value with -", () => {
    expect(formatSignedCurrency(-250.5)).toBe("-$250.50");
  });

  it("accepts a numeric string", () => {
    expect(formatSignedCurrency("100")).toBe("+$100.00");
  });
});

describe("formatMarketPrice", () => {
  it("returns -- for null input", () => {
    expect(formatMarketPrice(null)).toBe("--");
  });

  it("returns -- for Infinity", () => {
    expect(formatMarketPrice(Infinity)).toBe("--");
  });

  it("formats values >= 1 with 2 decimal places", () => {
    expect(formatMarketPrice(65000)).toBe("$65,000.00");
    expect(formatMarketPrice(1)).toBe("$1.00");
  });

  it("formats values < 1 with up to 8 decimal places", () => {
    const result = formatMarketPrice(0.00001234);
    expect(result).toContain("0.00001234");
  });

  it("formats values exactly equal to 1", () => {
    expect(formatMarketPrice(1)).toBe("$1.00");
  });
});
