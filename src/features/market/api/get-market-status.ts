import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { MarketStatusResponse } from "@/features/market/types/market-status.types";

// Public endpoint (no auth): the backend CORS allowlist covers the app origin, so the
// browser calls it directly. Switch to `endpoints.bff.marketStatus` + `sameOrigin: true`
// only if a cross-origin landing or edge caching is needed — the hook is agnostic.
export function getMarketStatus(signal?: AbortSignal): Promise<MarketStatusResponse> {
  return apiRequest<MarketStatusResponse>(endpoints.market.status, { signal });
}
