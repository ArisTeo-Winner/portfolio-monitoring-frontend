import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { PortfolioHistoryResponse } from "@/features/portfolio/types/portfolio-history.types";

export async function getPortfolioHistory(
  range: string,
  assetType?: string,
): Promise<PortfolioHistoryResponse> {
  const params = new URLSearchParams({ range });
  if (assetType) params.set("assetTypes", assetType);

  return apiRequest<PortfolioHistoryResponse>(
    `${endpoints.portfolio.history}?${params.toString()}`,
    { auth: true },
  );
}
