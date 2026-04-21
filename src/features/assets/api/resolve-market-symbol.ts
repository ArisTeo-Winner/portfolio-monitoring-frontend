import type { AssetOption } from "@/features/assets/types/asset.types";
import { getAssetPrice } from "@/features/marketdata/api/get-asset-price";

const resolvedSymbolCache = new Map<string, AssetOption | null>();
const inFlightRequests = new Map<string, Promise<AssetOption | null>>();

export async function resolveMarketSymbolCandidate(
  query: string,
  assetType: string,
): Promise<AssetOption | null> {
  const normalizedType = assetType.trim().toUpperCase();
  const normalizedSymbol = normalizeSymbol(query);

  if (!normalizedSymbol || !supportsDirectSymbolLookup(normalizedType)) {
    return null;
  }

  const cacheKey = `${normalizedType}:${normalizedSymbol}`;
  const cached = resolvedSymbolCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const pending = inFlightRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const request = getAssetPrice(normalizedSymbol, normalizedType)
    .then((price) => {
      const candidate: AssetOption = {
        assetId: normalizedSymbol.toLowerCase(),
        symbol: normalizedSymbol,
        name: normalizedSymbol,
        assetType: normalizedType,
        logoUrl: null,
        suggestedPrice: price,
        supportedForTransactions: true,
      };
      resolvedSymbolCache.set(cacheKey, candidate);
      return candidate;
    })
    .catch(() => {
      resolvedSymbolCache.set(cacheKey, null);
      return null;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, request);
  return request;
}

function normalizeSymbol(query: string) {
  const normalized = query.trim().toUpperCase();
  if (!normalized) return "";
  if (!/^[A-Z0-9.-]{1,15}$/.test(normalized)) return "";
  return normalized;
}

function supportsDirectSymbolLookup(assetType: string) {
  return assetType === "STOCK" || assetType === "STOCKS" || assetType === "ETF";
}
