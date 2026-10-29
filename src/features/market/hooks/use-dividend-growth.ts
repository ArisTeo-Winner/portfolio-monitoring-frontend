"use client";

import { useQuery } from "@tanstack/react-query";
import { getDividendGrowth } from "@/features/market/api/get-dividend-growth";

// Public, backend-cached ~1h, so keep it fresh client-side for the same window
// and never refetch on focus. Disabled until a symbol is known.
export function useDividendGrowth(symbol?: string) {
  return useQuery({
    queryKey: ["dividend-growth", symbol],
    queryFn: ({ signal }) => getDividendGrowth(symbol as string, signal),
    enabled: Boolean(symbol),
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
