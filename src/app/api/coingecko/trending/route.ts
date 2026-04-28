const COINGECKO_TRENDING_URL = "https://api.coingecko.com/api/v3/search/trending";
let cachedTrendingPayload: { payload: unknown; updatedAt: number } | null = null;

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

export async function GET() {
  try {
    const response = await fetch(COINGECKO_TRENDING_URL, {
      headers: { accept: "application/json" },
      cache: "force-cache",
      next: { revalidate: 1800 },
    });

    if (!response.ok) {
      if (cachedTrendingPayload) {
        return Response.json(cachedTrendingPayload.payload, {
          headers: buildProxyHeaders({ stale: true, updatedAt: cachedTrendingPayload.updatedAt }),
        });
      }

      return Response.json(
        { error: `CoinGecko trending request failed with status ${response.status}` },
        { status: response.status },
      );
    }

    const payload = await response.json();
    cachedTrendingPayload = { payload, updatedAt: Date.now() };
    return Response.json(payload, {
      headers: buildProxyHeaders({ stale: false, updatedAt: cachedTrendingPayload.updatedAt }),
    });
  } catch {
    if (cachedTrendingPayload) {
      return Response.json(cachedTrendingPayload.payload, {
        headers: buildProxyHeaders({ stale: true, updatedAt: cachedTrendingPayload.updatedAt }),
      });
    }

    return Response.json(
      { error: "CoinGecko trending request failed and no cached snapshot is available" },
      { status: 502 },
    );
  }
}
