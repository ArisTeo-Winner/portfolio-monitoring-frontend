const COINGECKO_MARKETS_URL = "https://api.coingecko.com/api/v3/coins/markets";
const TTL_HIT_MS = 6 * 60 * 60 * 1000; // 6h for resolved logos
const TTL_MISS_MS = 30 * 60 * 1000; // 30m negative cache (avoid hammering for unknown tickers)

type CacheEntry = { image: string | null; at: number };

// Per-symbol memory cache shared across requests in this server process. Keyed
// by UPPERCASE ticker. Misses are cached too (image: null) so a symbol CoinGecko
// does not know is not re-queried on every transactions load.
const logoCache = new Map<string, CacheEntry>();

/**
 * Server-side crypto logo resolver, keyed by ticker symbol. Queries the
 * CoinGecko markets endpoint filtered to the requested symbols and returns a
 * SYMBOL(upper) -> image URL map. Used by the /api/me/transactions BFF proxy to
 * enrich each crypto transaction's logoUrl with a live, correct icon, so the
 * frontend renders whatever the endpoint sends — no client-side logo lookup and
 * no manual catalog edits. Never throws: on any failure it returns whatever is
 * already cached, and the caller keeps the backend's original logoUrl.
 */
export async function fetchCryptoLogosBySymbols(symbols: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const wanted = Array.from(new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean)));

  const result: Record<string, string> = {};
  const missing: string[] = [];

  for (const symbol of wanted) {
    const entry = logoCache.get(symbol);
    const ttl = entry?.image ? TTL_HIT_MS : TTL_MISS_MS;
    if (entry && now - entry.at < ttl) {
      if (entry.image) result[symbol] = entry.image;
    } else {
      missing.push(symbol);
    }
  }

  if (!missing.length) return result;

  const resolved = await queryCoinGecko(missing);
  for (const symbol of missing) {
    const image = resolved[symbol] ?? null;
    logoCache.set(symbol, { image, at: now });
    if (image) result[symbol] = image;
  }

  return result;
}

async function queryCoinGecko(symbols: string[]): Promise<Record<string, string>> {
  const url = new URL(COINGECKO_MARKETS_URL);
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("symbols", symbols.join(",").toLowerCase());
  url.searchParams.set("order", "market_cap_desc");
  url.searchParams.set("per_page", "250");
  url.searchParams.set("page", "1");

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      // Upstream layer of caching; the per-symbol map above is the second.
      next: { revalidate: 3600 },
    });
    if (!response.ok) return {};

    const coins = (await response.json()) as Array<{
      symbol?: string;
      image?: string;
      market_cap?: number;
    }>;

    // A ticker can map to several CoinGecko coins; keep the highest market cap
    // (the dominant asset the user most likely holds).
    const best = new Map<string, { image: string; marketCap: number }>();
    for (const coin of coins) {
      if (!coin.symbol || !coin.image) continue;
      const key = coin.symbol.toUpperCase();
      const marketCap = coin.market_cap ?? 0;
      const prev = best.get(key);
      if (!prev || marketCap > prev.marketCap) {
        best.set(key, { image: coin.image, marketCap });
      }
    }

    const map: Record<string, string> = {};
    for (const [key, value] of best) map[key] = value.image;
    return map;
  } catch {
    return {};
  }
}
