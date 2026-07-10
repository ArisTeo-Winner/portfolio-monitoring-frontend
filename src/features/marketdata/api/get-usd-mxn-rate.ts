import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { FxRate } from "@/features/marketdata/types/price-history.types";

export async function getUsdMxnRate(): Promise<FxRate> {
  return apiRequest<FxRate>(endpoints.marketdata.usdMxnRate, { auth: true });
}
