const COINGECKO_TRENDING_URL = "https://api.coingecko.com/api/v3/search/trending";

export async function GET() {
  try {
    const response = await fetch(COINGECKO_TRENDING_URL, {
      headers: { accept: "application/json" },
      cache: "force-cache",
      next: { revalidate: 1800 },
    });

    if (!response.ok) {
      return Response.json(
        { error: `CoinGecko trending request failed with status ${response.status}` },
        { status: response.status },
      );
    }

    const payload = await response.json();
    return Response.json(payload);
  } catch {
    return Response.json(
      { error: "CoinGecko trending request failed" },
      { status: 502 },
    );
  }
}
