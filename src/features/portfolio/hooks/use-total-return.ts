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
export type TotalReturnBreakdown = {
  price: number; // plusvalía — price-only gain (allTimeProfit)
  income: number; // Σ net dividends
  totalReturn: number; // price + income
  totalReturnPercent: number; // percent (e.g. 45.00 = 45%), currency-invariant
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
    currency: resolveDisplayCurrency(data.presentation),
  };
}
