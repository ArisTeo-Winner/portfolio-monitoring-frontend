"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { ReceivedDividend } from "@/features/portfolio/types/received-dividend.types";

export function getReceivedDividends() {
  return apiRequest<ReceivedDividend[]>(endpoints.dividends.mine, { auth: true });
}

// "Mis Dividendos" — received dividends with the user's own amounts. The backend
// caches this ~5 min (private, max-age=300), so mirror that client-side and never
// refetch on focus. Additive endpoint: on a backend that predates ADR-0029 the
// query simply errors and the consuming section self-hides.
export function useReceivedDividends() {
  return useQuery({
    queryKey: ["received-dividends"],
    queryFn: getReceivedDividends,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
