const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3/coins/markets";

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

  try {
    const response = await fetch(`${COINGECKO_BASE_URL}?${upstreamParams.toString()}`, {
      headers: { accept: "application/json" },
      cache: "force-cache",
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return Response.json(
        { error: `CoinGecko request failed with status ${response.status}` },
        { status: response.status },
      );
    }

    const payload = await response.json();
    return Response.json(payload);
  } catch {
    return Response.json(
      { error: "CoinGecko request failed" },
      { status: 502 },
    );
  }
}
