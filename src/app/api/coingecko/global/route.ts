const COINGECKO_GLOBAL_URL = "https://api.coingecko.com/api/v3/global";

export async function GET() {
  try {
    const response = await fetch(COINGECKO_GLOBAL_URL, {
      headers: { accept: "application/json" },
      cache: "force-cache",
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return Response.json(
        { error: `CoinGecko global request failed with status ${response.status}` },
        { status: response.status },
      );
    }

    const payload = await response.json();
    return Response.json(payload);
  } catch {
    return Response.json(
      { error: "CoinGecko global request failed" },
      { status: 502 },
    );
  }
}
