import type { PresentationEnvelope } from "@/features/portfolio/types/presentation.types";

// ADR-0014 portfolio-wide Total Return aggregate (GET /me/portfolio/summary).
// Same calculation as holdings-performance but over the whole portfolio (scope
// ALL) and without the time series. Amounts are already in the user's
// presentation currency (ADR-0010); percents are currency-invariant.
//
// Empty portfolio: amounts are 0 and the dividend-aware figures are null, which
// the Total Return consumer treats as "no breakdown → price-only fallback".
export type PortfolioSummaryResponse = {
  costBasis: number; // total invested incl. the cost of already-sold positions
  allTimeProfit: number; // plusvalía (realized + unrealized)
  allTimeProfitPercent: number;
  dividendIncome: number | null; // Σ net dividends
  totalReturn: number | null; // allTimeProfit + dividendIncome
  totalReturnPercent: number | null; // percent (e.g. 45.00 = 45%)
  // Split components of allTimeProfit (additive; present once the backend exposes
  // them — see ADR-0014). Until then the Total Return consumer derives the split
  // from allTimeProfit minus the entries' unrealized P&L.
  realizedPnl?: number | null; // gain locked in by sells
  unrealizedPnl?: number | null; // gain on current holdings (= Σ entries.totalProfitLoss)
  presentation?: PresentationEnvelope;
};
