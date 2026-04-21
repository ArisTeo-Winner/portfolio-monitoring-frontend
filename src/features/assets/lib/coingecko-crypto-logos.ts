"use client";

const CACHE_KEY = "coingecko-crypto-markets-top500-v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let logoMapRequest: Promise<Record<string, string>> | null = null;

type CoinGeckoMarketCoin = {
  id: string;
  symbol: string;
  image?: string;
};

type CachedCoin = {
  id: string;
  symbol: string;
  image: string | null;
};

export function readCoinGeckoCryptoLogoMap() {
  const cached = readCache();
  return toLogoMap(cached);
}

export async function fetchCoinGeckoCryptoLogoMap() {
  const cached = readCache();
  if (cached.length) {
    return toLogoMap(cached);
  }

  if (logoMapRequest) {
    return logoMapRequest;
  }

  logoMapRequest = (async () => {
    const [pageOne, pageTwo] = await Promise.all([fetchMarketsPage(1), fetchMarketsPage(2)]);
    const items = [...pageOne, ...pageTwo]
      .filter((coin, index, source) => source.findIndex((item) => item.id === coin.id) === index)
      .slice(0, 500);

    writeCache(items);
    return toLogoMap(items);
  })();

  try {
    return await logoMapRequest;
  } finally {
    logoMapRequest = null;
  }
}

async function fetchMarketsPage(page: number) {
  const params = new URLSearchParams({
    vs_currency: "usd",
    order: "market_cap_desc",
    per_page: "250",
    page: page.toString(),
    sparkline: "false",
    price_change_percentage: "1h",
  });

  const response = await fetch(`/api/coingecko/markets?${params.toString()}`, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`CoinGecko request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as CoinGeckoMarketCoin[];
  return payload.map((coin) => ({
    id: coin.id,
    symbol: coin.symbol,
    image: coin.image ?? null,
  }));
}

function toLogoMap(items: CachedCoin[]) {
  return items.reduce<Record<string, string>>((map, coin) => {
    if (coin.symbol && coin.image) {
      map[coin.symbol.toUpperCase()] = coin.image;
    }
    return map;
  }, {});
}

function readCache() {
  if (typeof window === "undefined") return [] as CachedCoin[];

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [] as CachedCoin[];

    const parsed = JSON.parse(raw) as { timestamp?: number; items?: CachedCoin[] };
    if (!parsed.timestamp || !parsed.items?.length) return [] as CachedCoin[];
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return [] as CachedCoin[];

    return parsed.items;
  } catch {
    return [] as CachedCoin[];
  }
}

function writeCache(items: CachedCoin[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        items,
      }),
    );
  } catch {
    // Ignore storage failures.
  }
}
