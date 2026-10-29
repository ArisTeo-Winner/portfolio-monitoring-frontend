import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { endpoints } from "@/lib/api/endpoints";
import { fetchCryptoLogosBySymbols } from "@/lib/marketdata/coingecko-logos.server";

/**
 * BFF proxy for the transactions list.
 *
 * Forwards the authenticated request to the Spring backend, then enriches each
 * CRYPTO transaction's `logoUrl` with a live CoinGecko icon (server-side). The
 * backend stores crypto icons as guessed static-repo URLs that 404 for coins
 * not in that frozen repo (e.g. HYPE); resolving them here keeps the endpoint
 * the single source of the icon while guaranteeing a valid URL, with no
 * client-side logo logic and no manual catalog maintenance.
 */

type BackendTransaction = {
  assetSymbol?: string;
  assetType?: string;
  logoUrl?: string | null;
  [key: string]: unknown;
};

function isCrypto(assetType: unknown): boolean {
  return typeof assetType === "string" && assetType.trim().toUpperCase() === "CRYPTO";
}

export async function GET(request: NextRequest) {
  const incoming = new URL(request.url);
  const backendUrl = new URL(`${env.apiBaseUrl}${endpoints.transactions.me}`);
  for (const key of ["assetSymbol", "transactionType"] as const) {
    const value = incoming.searchParams.get(key);
    if (value) backendUrl.searchParams.set(key, value);
  }

  // Forward the caller's bearer token; the transactions endpoint authorizes on
  // it. (Cookies are intentionally not forwarded — they belong to this origin,
  // not the backend, and the endpoint does not use them.)
  const headers: Record<string, string> = { accept: "application/json" };
  const authorization = request.headers.get("authorization");
  if (authorization) headers.authorization = authorization;

  let backendResponse: Response;
  try {
    backendResponse = await fetch(backendUrl, { headers, cache: "no-store" });
  } catch {
    return NextResponse.json({ detail: "Transactions service unavailable" }, { status: 503 });
  }

  const raw = await backendResponse.text();

  if (!backendResponse.ok) {
    // Propagate the status verbatim (esp. 401) so the client's refresh flow reacts.
    return new NextResponse(raw, {
      status: backendResponse.status,
      headers: { "content-type": backendResponse.headers.get("content-type") ?? "application/json" },
    });
  }

  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : [];
  } catch {
    return new NextResponse(raw, { status: 200 });
  }

  if (!Array.isArray(data)) return NextResponse.json(data);

  const transactions = data as BackendTransaction[];
  const cryptoSymbols = Array.from(
    new Set(
      transactions
        .filter((t) => isCrypto(t.assetType) && typeof t.assetSymbol === "string")
        .map((t) => (t.assetSymbol as string).toUpperCase()),
    ),
  );

  const logoMap = cryptoSymbols.length ? await fetchCryptoLogosBySymbols(cryptoSymbols) : {};

  const enriched = transactions.map((transaction) => {
    if (isCrypto(transaction.assetType) && typeof transaction.assetSymbol === "string") {
      const image = logoMap[transaction.assetSymbol.toUpperCase()];
      if (image) return { ...transaction, logoUrl: image };
    }
    return transaction;
  });

  return NextResponse.json(enriched);
}
