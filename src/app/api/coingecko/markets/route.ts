const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3/coins/markets";
const MARKETS_FALLBACK_CACHE = new Map<string, { payload: unknown; updatedAt: number }>();

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
    vs_currency: searchParams.get("vs_currency") ?? "usd",
    order: searchParams.get("order") ?? "market_cap_desc",
    per_page: searchParams.get("per_page") ?? "250",
    page: searchParams.get("page") ?? "1",
    sparkline: searchParams.get("sparkline") ?? "false",
    price_change_percentage: searchParams.get("price_change_percentage") ?? "1h",
  });
  const cacheKey = upstreamParams.toString();
  const cached = MARKETS_FALLBACK_CACHE.get(cacheKey);

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
    MARKETS_FALLBACK_CACHE.set(cacheKey, { payload, updatedAt: Date.now() });
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
