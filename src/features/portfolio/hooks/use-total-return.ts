"use client";

import { usePortfolioSummary } from "@/features/portfolio/api/get-portfolio-summary";
import { resolveDisplayCurrency } from "@/lib/utils/currency";

type DisplayCurrency = ReturnType<typeof resolveDisplayCurrency>;

// ADR-0014 Total Return breakdown for the consolidated view.
//
// Source: the portfolio-wide aggregate `GET /me/portfolio/summary` (scope ALL).
// Returns null on pre-ADR-0014 backends (endpoint missing → query error) and on
// an empty portfolio (dividend-aware figures come back null); in both cases the
// caller falls back to the price-only "All-time Profit" view.
//
// `realized`/`unrealized` are null until the backend exposes realizedPnl/
// unrealizedPnl; consumers then derive the split as allTimeProfit minus the
// entries' unrealized P&L (which they already have), so the breakdown reconciles.
export type TotalReturnBreakdown = {
  price: number; // plusvalía — allTimeProfit (realized + unrealized)
  income: number; // Σ net dividends
  totalReturn: number; // price + income
  totalReturnPercent: number; // percent (e.g. 45.00 = 45%), currency-invariant
  costBasis: number; // total invested incl. already-sold positions
  realized: number | null; // from realizedPnl, else null → caller derives
  unrealized: number | null; // from unrealizedPnl, else null → caller derives
  currency: DisplayCurrency;
};

export function useTotalReturn(): TotalReturnBreakdown | null {
  const { data } = usePortfolioSummary();

  if (!data || data.dividendIncome == null || data.totalReturn == null) return null;

  return {
    price: data.allTimeProfit,
    income: data.dividendIncome,
    totalReturn: data.totalReturn,
    totalReturnPercent: data.totalReturnPercent ?? 0,
    costBasis: data.costBasis,
    realized: data.realizedPnl ?? null,
    unrealized: data.unrealizedPnl ?? null,
    currency: resolveDisplayCurrency(data.presentation),
  };
}
