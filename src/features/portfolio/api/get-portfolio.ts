import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";

const PORTFOLIO_CACHE_TTL_MS = 1500;

let portfolioCache: PortfolioEntry[] | null = null;
let portfolioCacheAt = 0;
let portfolioInFlight: Promise<PortfolioEntry[]> | null = null;

export async function getPortfolio(options: { force?: boolean } = {}) {
  const { force = false } = options;
  const now = Date.now();

  if (!force) {
    if (portfolioCache && now - portfolioCacheAt < PORTFOLIO_CACHE_TTL_MS) {
      return portfolioCache;
    }

    if (portfolioInFlight) {
      return portfolioInFlight;
    }
  }

  const request = apiRequest<PortfolioEntry[]>(endpoints.portfolio.me, { auth: true, method: "GET" })
    .then((data) => {
      portfolioCache = data;
      portfolioCacheAt = Date.now();
      return data;
    })
    .finally(() => {
      portfolioInFlight = null;
    });

  portfolioInFlight = request;
  return request;
}

export function invalidatePortfolioCache() {
  portfolioCache = null;
  portfolioCacheAt = 0;
  portfolioInFlight = null;
}
