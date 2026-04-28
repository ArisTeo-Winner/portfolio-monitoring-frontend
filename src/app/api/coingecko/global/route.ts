const COINGECKO_GLOBAL_URL = "https://api.coingecko.com/api/v3/global";
let cachedGlobalPayload: { payload: unknown; updatedAt: number } | null = null;

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
    const response = await fetch(COINGECKO_GLOBAL_URL, {
      headers: { accept: "application/json" },
      cache: "force-cache",
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      if (cachedGlobalPayload) {
        return Response.json(cachedGlobalPayload.payload, {
          headers: buildProxyHeaders({ stale: true, updatedAt: cachedGlobalPayload.updatedAt }),
        });
      }

      return Response.json(
        { error: `CoinGecko global request failed with status ${response.status}` },
        { status: response.status },
      );
    }

    const payload = await response.json();
    cachedGlobalPayload = { payload, updatedAt: Date.now() };
    return Response.json(payload, {
      headers: buildProxyHeaders({ stale: false, updatedAt: cachedGlobalPayload.updatedAt }),
    });
  } catch {
    if (cachedGlobalPayload) {
      return Response.json(cachedGlobalPayload.payload, {
        headers: buildProxyHeaders({ stale: true, updatedAt: cachedGlobalPayload.updatedAt }),
      });
    }

    return Response.json(
      { error: "CoinGecko global request failed and no cached snapshot is available" },
      { status: 502 },
    );
  }
}
