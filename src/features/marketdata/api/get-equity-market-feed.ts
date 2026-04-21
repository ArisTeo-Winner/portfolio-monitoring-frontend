import { getAssetPrice } from "@/features/marketdata/api/get-asset-price";
import type { MarketCategory, MarketRow } from "@/features/marketdata/types/market.types";

export type EquityMarketSeed = {
  assetId?: string;
  symbol: string;
  name: string;
  assetType: "STOCK" | "ETF";
  logoUrl?: string | null;
  rank?: number | null;
  tvSymbol?: string;
};

export async function getEquityMarketFeed(seeds: EquityMarketSeed[]): Promise<MarketRow[]> {
  const uniqueSeeds = deduplicateSeeds(seeds);

  const rows: Array<MarketRow | null> = await Promise.all(
    uniqueSeeds.map(async (seed, index) => {
      try {
        const price = await getAssetPrice(seed.symbol, seed.assetType);

        return {
          id: `${seed.assetType}:${seed.symbol.toUpperCase()}`,
          rank: seed.rank ?? index + 1,
          assetId: seed.assetId ?? seed.symbol.toLowerCase(),
          name: seed.name,
          symbol: seed.symbol.toUpperCase(),
          assetType: seed.assetType,
          logoUrl: seed.logoUrl ?? null,
          price,
          change1h: null,
          change24h: null,
          change7d: null,
          marketCap: null,
          volume24h: null,
          sparkline: [],
          tvSymbol: seed.tvSymbol ?? buildEquityTvSymbol(seed.symbol, seed.assetType),
        } satisfies MarketRow;
      } catch {
        return null;
      }
    }),
  );

  return rows.filter((row): row is MarketRow => Boolean(row));
}

function deduplicateSeeds(seeds: EquityMarketSeed[]) {
  const unique = new Map<string, EquityMarketSeed>();

  seeds.forEach((seed) => {
    const normalizedSymbol = seed.symbol.trim().toUpperCase();
    const key = `${seed.assetType}:${normalizedSymbol}`;
    const current = unique.get(key);

    unique.set(key, {
      assetId: seed.assetId ?? current?.assetId ?? normalizedSymbol.toLowerCase(),
      symbol: normalizedSymbol,
      name: seed.name?.trim() || current?.name || normalizedSymbol,
      assetType: seed.assetType,
      logoUrl: seed.logoUrl ?? current?.logoUrl ?? null,
      rank: seed.rank ?? current?.rank ?? null,
      tvSymbol: seed.tvSymbol ?? current?.tvSymbol,
    });
  });

  return Array.from(unique.values());
}

function buildEquityTvSymbol(symbol: string, assetType: MarketCategory) {
  const normalized = symbol.trim().toUpperCase();
  if (assetType === "ETF" && normalized === "SPY") return "AMEX:SPY";
  if (assetType === "ETF" && normalized === "QQQ") return "NASDAQ:QQQ";
  return `NASDAQ:${normalized}`;
}
