import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { BmvPricePoint } from "@/features/marketdata/types/price-history.types";

export async function getBmvHistorical(symbol: string, from: string, to: string): Promise<BmvPricePoint[]> {
  return apiRequest<BmvPricePoint[]>(endpoints.marketdata.bmvHistorical(symbol, from, to), {
    auth: true,
  });
}
