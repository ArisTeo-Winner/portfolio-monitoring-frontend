import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { MarkToMarketResponse } from "@/features/portfolio/types/cetes.types";

export async function getCetesMarkToMarket(transactionId: string): Promise<MarkToMarketResponse> {
  return apiRequest<MarkToMarketResponse>(endpoints.portfolio.cetesMarkToMarket(transactionId), {
    auth: true,
  });
}
