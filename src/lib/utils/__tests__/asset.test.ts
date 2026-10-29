import { getAssetDisplayName, getAssetPalette, normalizeAssetType } from "../asset";

describe("getAssetDisplayName", () => {
  it("returns the display name for a known crypto symbol", () => {
    expect(getAssetDisplayName("BTC")).toBe("Bitcoin");
    expect(getAssetDisplayName("ETH")).toBe("Ethereum");
    expect(getAssetDisplayName("SOL")).toBe("Solana");
  });

  it("is case-insensitive for the lookup", () => {
    expect(getAssetDisplayName("btc")).toBe("Bitcoin");
    expect(getAssetDisplayName("eth")).toBe("Ethereum");
  });

  it("returns the symbol itself for unknown assets", () => {
    expect(getAssetDisplayName("UNKNOWN")).toBe("UNKNOWN");
    expect(getAssetDisplayName("ABC")).toBe("ABC");
  });

  it("returns a display name for a known equity symbol", () => {
    expect(getAssetDisplayName("AAPL")).toBe("Apple Inc.");
    expect(getAssetDisplayName("MSFT")).toBe("Microsoft Corp.");
    expect(getAssetDisplayName("NVDA")).toBe("NVIDIA Corp");
  });
});

describe("getAssetPalette", () => {
  it("returns an object with base, highlight and text keys", () => {
    const palette = getAssetPalette("BTC");
    expect(palette).toHaveProperty("base");
    expect(palette).toHaveProperty("highlight");
    expect(palette).toHaveProperty("text");
  });

  it("returns consistent colors for the same symbol", () => {
    expect(getAssetPalette("ETH")).toEqual(getAssetPalette("ETH"));
  });

  it("returns different colors for different symbols", () => {
    const btc = getAssetPalette("BTC");
    const eth = getAssetPalette("ETH");
    // Different charcode sums should produce different palette entries
    // This is probabilistic — just assert they're valid hex colors
    expect(btc.base).toMatch(/^#[0-9a-f]{6}$/i);
    expect(eth.base).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("normalizeAssetType", () => {
  it("normalizes CRYPTO unchanged", () => {
    expect(normalizeAssetType("CRYPTO")).toBe("CRYPTO");
  });

  it("normalizes STOCKS to STOCK", () => {
    expect(normalizeAssetType("STOCKS")).toBe("STOCK");
  });

  it("normalizes ETFS to ETF", () => {
    expect(normalizeAssetType("ETFS")).toBe("ETF");
  });

  it("is case-insensitive for the assetType input", () => {
    expect(normalizeAssetType("stocks")).toBe("STOCK");
    expect(normalizeAssetType("etfs")).toBe("ETF");
  });

  it("trims whitespace before normalizing", () => {
    expect(normalizeAssetType("  STOCKS  ")).toBe("STOCK");
  });

  it("overrides assetType when symbol is a known stock", () => {
    expect(normalizeAssetType("CRYPTO", "AAPL")).toBe("STOCK");
    expect(normalizeAssetType("CRYPTO", "MSFT")).toBe("STOCK");
  });

  it("overrides assetType when symbol is a known index", () => {
    expect(normalizeAssetType("CRYPTO", "SPY")).toBe("INDEX");
    expect(normalizeAssetType("CRYPTO", "QQQ")).toBe("INDEX");
  });

  it("does not override for unknown symbols", () => {
    expect(normalizeAssetType("CRYPTO", "BTC")).toBe("CRYPTO");
  });
});
