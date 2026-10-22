import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { DividendGrowthResponse } from "@/features/market/types/dividend-growth.types";

// Public endpoint (no auth), backend-cached ~1h. Mirrors getMarketStatus.
export function getDividendGrowth(symbol: string, signal?: AbortSignal): Promise<DividendGrowthResponse> {
  return apiRequest<DividendGrowthResponse>(endpoints.market.dividendGrowth(symbol), { signal });
}
