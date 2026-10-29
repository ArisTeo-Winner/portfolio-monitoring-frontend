const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3/coins/markets";

// Bounded fallback cache: a fixed-capacity LRU (insertion-ordered Map) with a
// per-entry TTL. This caps memory regardless of how many distinct cache keys a
// client can mint, and evicts entries that are too stale to serve on error.
const MARKETS_FALLBACK_MAX_ENTRIES = 32;
const MARKETS_FALLBACK_TTL_MS = 24 * 60 * 60 * 1000; // 24h staleness bound
const MARKETS_FALLBACK_CACHE = new Map<string, { payload: unknown; updatedAt: number }>();

// Allowlists / clamps that collapse the attacker-controllable key space into a
// small, canonical set. Unrecognized enum values fall back to the existing
// default and numeric values are clamped to CoinGecko's documented ranges, so a
// legitimate request with normal values is forwarded exactly as before.
const VS_CURRENCY_ALLOWLIST = new Set(["usd", "eur", "gbp", "jpy", "btc", "eth"]);
const ORDER_ALLOWLIST = new Set([
  "market_cap_desc",
  "market_cap_asc",
  "volume_desc",
  "volume_asc",
  "id_desc",
  "id_asc",
]);
const SPARKLINE_ALLOWLIST = new Set(["true", "false"]);
const PRICE_CHANGE_ALLOWLIST = new Set(["1h", "24h", "7d", "1h,24h,7d"]);

function normalizeEnum(value: string | null, allowlist: Set<string>, fallback: string) {
  return value !== null && allowlist.has(value) ? value : fallback;
}

function normalizeInt(value: string | null, min: number, max: number, fallback: number) {
  const parsed = value === null ? Number.NaN : Number.parseInt(value, 10);
  const bounded = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  return String(bounded);
}

function readFallback(cacheKey: string) {
  const entry = MARKETS_FALLBACK_CACHE.get(cacheKey);
  if (!entry) {
    return undefined;
  }
  if (Date.now() - entry.updatedAt > MARKETS_FALLBACK_TTL_MS) {
    MARKETS_FALLBACK_CACHE.delete(cacheKey);
    return undefined;
  }
  // Bump recency: re-inserting moves the key to the newest position.
  MARKETS_FALLBACK_CACHE.delete(cacheKey);
  MARKETS_FALLBACK_CACHE.set(cacheKey, entry);
  return entry;
}

function writeFallback(cacheKey: string, payload: unknown, updatedAt: number) {
  MARKETS_FALLBACK_CACHE.delete(cacheKey);
  MARKETS_FALLBACK_CACHE.set(cacheKey, { payload, updatedAt });
  while (MARKETS_FALLBACK_CACHE.size > MARKETS_FALLBACK_MAX_ENTRIES) {
    const oldestKey = MARKETS_FALLBACK_CACHE.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    MARKETS_FALLBACK_CACHE.delete(oldestKey);
  }
}

function buildProxyHeaders({
  stale,
  updatedAt,
}: {
  stale: boolean;
  updatedAt: number;
}) {
  return {
    "x-upstream-source": stale ? "coingecko-stale-cache" : "coingecko-live",
    "x-upstream-updated-at": new Date(updatedAt).toISOString(),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const upstreamParams = new URLSearchParams({
    vs_currency: normalizeEnum(searchParams.get("vs_currency"), VS_CURRENCY_ALLOWLIST, "usd"),
    order: normalizeEnum(searchParams.get("order"), ORDER_ALLOWLIST, "market_cap_desc"),
    per_page: normalizeInt(searchParams.get("per_page"), 1, 250, 250),
    page: normalizeInt(searchParams.get("page"), 1, 100, 1),
    sparkline: normalizeEnum(searchParams.get("sparkline"), SPARKLINE_ALLOWLIST, "false"),
    price_change_percentage: normalizeEnum(
      searchParams.get("price_change_percentage"),
      PRICE_CHANGE_ALLOWLIST,
      "1h",
    ),
  });
  const cacheKey = upstreamParams.toString();
  const cached = readFallback(cacheKey);

  try {
    const response = await fetch(`${COINGECKO_BASE_URL}?${upstreamParams.toString()}`, {
      headers: { accept: "application/json" },
      cache: "force-cache",
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      if (cached) {
        return Response.json(cached.payload, {
          headers: buildProxyHeaders({ stale: true, updatedAt: cached.updatedAt }),
        });
      }

      return Response.json(
        { error: `CoinGecko request failed with status ${response.status}` },
        { status: response.status },
      );
    }

    const payload = await response.json();
    writeFallback(cacheKey, payload, Date.now());
    return Response.json(payload, {
      headers: buildProxyHeaders({ stale: false, updatedAt: Date.now() }),
    });
  } catch {
    if (cached) {
      return Response.json(cached.payload, {
        headers: buildProxyHeaders({ stale: true, updatedAt: cached.updatedAt }),
      });
    }

    return Response.json(
      { error: "CoinGecko request failed and no cached snapshot is available" },
      { status: 502 },
    );
  }
}
