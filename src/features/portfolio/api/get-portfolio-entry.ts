import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";

export function getPortfolioEntry(symbol: string) {
  return apiRequest<PortfolioEntry>(endpoints.portfolio.bySymbol(symbol), {
    auth: true,
    method: "GET",
  });
}
