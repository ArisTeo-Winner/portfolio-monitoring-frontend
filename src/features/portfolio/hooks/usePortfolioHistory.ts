"use client";

import { useQuery } from "@tanstack/react-query";
import { getPortfolioHistory } from "@/features/portfolio/api/get-portfolio-history";

/**
 * Fetches portfolio holdings history.
 * - assetType: when provided, returns history filtered to that asset type only.
 *   Pass undefined (or "overview") to get the consolidated total portfolio history.
 */
export function usePortfolioHistory(range: string, assetType?: string) {
  const normalizedAssetType = assetType && assetType !== "overview" ? assetType : undefined;

  return useQuery({
    queryKey: ["portfolio-history", range, normalizedAssetType ?? "total"],
    queryFn: () => getPortfolioHistory(range, normalizedAssetType),
    staleTime: 30_000,
  });
}
