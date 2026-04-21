"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { HoldingsPerformanceResponse } from "@/features/portfolio/types/holdings-performance.types";

export type HoldingsPerformancePeriod = "24h" | "7d" | "30d" | "90d" | "ALL";

export async function getHoldingsPerformance(
  portfolioId: string,
  period: HoldingsPerformancePeriod = "ALL",
) {
  const searchParams = new URLSearchParams({ period });
  const path = `${endpoints.portfolio.holdingsPerformance(portfolioId)}?${searchParams.toString()}`;

  return apiRequest<HoldingsPerformanceResponse>(path, {
    auth: true,
  });
}

export function useHoldingsPerformance(
  portfolioId: string,
  period: HoldingsPerformancePeriod = "ALL",
) {
  return useQuery({
    queryKey: ["portfolio-holdings-performance", portfolioId, period],
    queryFn: () => getHoldingsPerformance(portfolioId, period),
    enabled: Boolean(portfolioId),
  });
}
