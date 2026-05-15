import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { PortfolioHistoryResponse } from "@/features/portfolio/types/portfolio-history.types";

export async function getPortfolioHistory(range: string): Promise<PortfolioHistoryResponse> {
  return apiRequest<PortfolioHistoryResponse>(
    `${endpoints.portfolio.history}?range=${encodeURIComponent(range)}`,
    { auth: true },
  );
}
