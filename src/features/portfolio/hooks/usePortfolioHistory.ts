"use client";

import { useQuery } from "@tanstack/react-query";
import { getPortfolioHistory } from "@/features/portfolio/api/get-portfolio-history";

export function usePortfolioHistory(range: string) {
  return useQuery({
    queryKey: ["portfolio-history", range],
    queryFn: () => getPortfolioHistory(range),
    staleTime: 30_000,
  });
}
