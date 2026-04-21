import type {
  MarketOverviewStats,
  MarketRow,
  TrendingMarketAsset,
} from "@/features/marketdata/types/market.types";

type RawCoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  image?: string | null;
  current_price: number;
  market_cap?: number | null;
  total_volume?: number | null;
  market_cap_rank?: number | null;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  sparkline_in_7d?: {
    price?: number[];
  } | null;
};

type RawGlobalResponse = {
  data?: {
    total_market_cap?: Record<string, number>;
    total_volume?: Record<string, number>;
    market_cap_change_percentage_24h_usd?: number;
    market_cap_percentage?: Record<string, number>;
  };
};

type RawTrendingResponse = {
  coins?: Array<{
    item?: {
      id: string;
      name: string;
      symbol: string;
      thumb?: string | null;
      market_cap_rank?: number | null;
      price_btc?: number | null;
    };
  }>;
};

export async function getCryptoMarketFeed(options: {
  page?: number;
  perPage?: number;
} = {}): Promise<MarketRow[]> {
  const { page = 1, perPage = 20 } = options;
  const params = new URLSearchParams({
    vs_currency: "usd",
    order: "market_cap_desc",
    per_page: String(perPage),
    page: String(page),
    sparkline: "true",
    price_change_percentage: "1h,24h,7d",
  });

  const payload = await fetchJson<RawCoinGeckoMarket[]>(`/api/coingecko/markets?${params.toString()}`);
  return payload.map((asset) => ({
    id: `CRYPTO:${asset.symbol.toUpperCase()}`,
    rank: asset.market_cap_rank ?? null,
    assetId: asset.id,
    name: asset.name,
    symbol: asset.symbol.toUpperCase(),
    assetType: "CRYPTO",
    logoUrl: asset.image ?? null,
    price: Number(asset.current_price ?? 0),
    change1h: toNullableNumber(asset.price_change_percentage_1h_in_currency),
    change24h: toNullableNumber(asset.price_change_percentage_24h_in_currency),
    change7d: toNullableNumber(asset.price_change_percentage_7d_in_currency),
    marketCap: toNullableNumber(asset.market_cap),
    volume24h: toNullableNumber(asset.total_volume),
    sparkline: Array.isArray(asset.sparkline_in_7d?.price)
      ? asset.sparkline_in_7d?.price?.map((value) => Number(value)).filter(Number.isFinite) ?? []
      : [],
    tvSymbol: buildCryptoTvSymbol(asset.symbol),
  }));
}

export async function getGlobalMarketOverview(): Promise<MarketOverviewStats> {
  const payload = await fetchJson<RawGlobalResponse>("/api/coingecko/global");
  const marketCapUsd = payload.data?.total_market_cap?.usd ?? null;
  const volume24hUsd = payload.data?.total_volume?.usd ?? null;
  const btcDominance = payload.data?.market_cap_percentage?.btc ?? null;
  const marketCapChangePercentage24hUsd = payload.data?.market_cap_change_percentage_24h_usd ?? null;

  return {
    marketCapUsd: toNullableNumber(marketCapUsd),
    volume24hUsd: toNullableNumber(volume24hUsd),
    btcDominance: toNullableNumber(btcDominance),
    marketCapChangePercentage24hUsd: toNullableNumber(marketCapChangePercentage24hUsd),
    volume24hChangePercentage: null,
  };
}

export async function getTrendingMarketAssets(): Promise<TrendingMarketAsset[]> {
  const payload = await fetchJson<RawTrendingResponse>("/api/coingecko/trending");
  return (payload.coins ?? [])
    .map((entry) => entry.item)
    .filter((item): item is NonNullable<typeof item> => Boolean(item?.id && item?.symbol && item?.name))
    .map((item) => ({
      id: item.id,
      name: item.name,
      symbol: item.symbol.toUpperCase(),
      thumbUrl: item.thumb ?? null,
      marketCapRank: item.market_cap_rank ?? null,
      priceBtc: toNullableNumber(item.price_btc),
    }));
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function buildCryptoTvSymbol(symbol: string) {
  const normalized = symbol.toUpperCase();
  if (normalized === "USDT") return "CRYPTOCAP:USDT";
  if (normalized === "USDC") return "CRYPTOCAP:USDC";
  return `BINANCE:${normalized}USDT`;
}

function toNullableNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
