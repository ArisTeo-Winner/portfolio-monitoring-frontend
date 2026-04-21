export type MarketCategory = "CRYPTO" | "STOCK" | "ETF";

export type MarketRow = {
  id: string;
  rank: number | null;
  assetId: string;
  name: string;
  symbol: string;
  assetType: MarketCategory;
  logoUrl: string | null;
  price: number;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  marketCap: number | null;
  volume24h: number | null;
  sparkline: number[];
  tvSymbol: string;
};

export type MarketOverviewStats = {
  marketCapUsd: number | null;
  marketCapChangePercentage24hUsd: number | null;
  volume24hUsd: number | null;
  volume24hChangePercentage: number | null;
  btcDominance: number | null;
};

export type TrendingMarketAsset = {
  id: string;
  name: string;
  symbol: string;
  thumbUrl: string | null;
  marketCapRank: number | null;
  priceBtc: number | null;
};
