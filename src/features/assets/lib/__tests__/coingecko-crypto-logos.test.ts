import { beforeEach, describe, expect, it } from "vitest";
import { readCoinGeckoCryptoLogoMap } from "@/features/assets/lib/coingecko-crypto-logos";

const CACHE_KEY = "coingecko-crypto-markets-top500-v1";
const DAY_MS = 24 * 60 * 60 * 1000;

function seedCache(items: unknown[], ageMs = 0) {
  window.localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ timestamp: Date.now() - ageMs, items }),
  );
}

describe("readCoinGeckoCryptoLogoMap", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty map when nothing is cached", () => {
    expect(readCoinGeckoCryptoLogoMap()).toEqual({});
  });

  it("keys logos by uppercased symbol", () => {
    seedCache([{ id: "binancecoin", symbol: "bnb", image: "https://logos/bnb.png" }]);
    expect(readCoinGeckoCryptoLogoMap()).toEqual({ BNB: "https://logos/bnb.png" });
  });

  it("keeps the first (highest market cap) coin when two share a ticker", () => {
    // Markets are cached in market_cap_desc order, so the canonical coin is
    // first; a lower-cap impostor sharing the ticker must not overwrite it.
    seedCache([
      { id: "binancecoin", symbol: "bnb", image: "https://logos/binancecoin.png" },
      { id: "fake-bnb", symbol: "bnb", image: "https://logos/impostor.png" },
    ]);
    expect(readCoinGeckoCryptoLogoMap().BNB).toBe("https://logos/binancecoin.png");
  });

  it("ignores a coin without an image", () => {
    seedCache([{ id: "noimg", symbol: "xyz", image: null }]);
    expect(readCoinGeckoCryptoLogoMap()).toEqual({});
  });

  it("ignores an expired cache", () => {
    seedCache([{ id: "binancecoin", symbol: "bnb", image: "x" }], DAY_MS + 60_000);
    expect(readCoinGeckoCryptoLogoMap()).toEqual({});
  });
});
