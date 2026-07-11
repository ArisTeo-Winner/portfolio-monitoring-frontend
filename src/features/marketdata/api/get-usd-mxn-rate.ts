import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { FxRate } from "@/features/marketdata/types/price-history.types";

export async function getUsdMxnRate(): Promise<FxRate> {
  return apiRequest<FxRate>(endpoints.marketdata.usdMxnRate, { auth: true });
}

// FX moves slowly enough that portfolio-total consumers (header, dashboard,
// /portfolio, the store) can share one short-lived cache instead of each
// firing its own request on mount.
const FX_RATE_CACHE_TTL_MS = 5 * 60 * 1000;

let fxRateCache: FxRate | null = null;
let fxRateCacheAt = 0;
let fxRateInFlight: Promise<FxRate> | null = null;

export async function getUsdMxnRateCached(): Promise<FxRate> {
  const now = Date.now();

  if (fxRateCache && now - fxRateCacheAt < FX_RATE_CACHE_TTL_MS) {
    return fxRateCache;
  }

  if (fxRateInFlight) {
    return fxRateInFlight;
  }

  const request = getUsdMxnRate()
    .then((data) => {
      fxRateCache = data;
      fxRateCacheAt = Date.now();
      return data;
    })
    .finally(() => {
      fxRateInFlight = null;
    });

  fxRateInFlight = request;
  return request;
}
