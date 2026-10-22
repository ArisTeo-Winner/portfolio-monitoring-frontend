"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { PortfolioSummaryResponse } from "@/features/portfolio/types/portfolio-summary.types";

export function getPortfolioSummary() {
  return apiRequest<PortfolioSummaryResponse>(endpoints.portfolio.summary, { auth: true });
}

export function usePortfolioSummary() {
  return useQuery({
    queryKey: ["portfolio-summary"],
    queryFn: getPortfolioSummary,
  });
}
