export type HoldingsPerformancePoint = {
  time: number;
  value: number;
};

import type { PresentationEnvelope } from "@/features/portfolio/types/presentation.types";

export type HoldingsPerformanceResponse = {
  series: HoldingsPerformancePoint[];
  isProfit: boolean;
  // Price-only gain (plusvalía). Unchanged by ADR-0014.
  allTimeProfit: number;
  costBasis: number;
  // ADR-0014 Total Return (additive; absent on pre-ADR-0014 backends):
  //   dividendIncome     = Σ NET dividend (gross − withholding)
  //   totalReturn        = allTimeProfit + dividendIncome
  //   totalReturnPercent = percent (e.g. 45.00 = 45%), currency-invariant
  // The consolidated UI reads the SAME figures from the portfolio-wide aggregate
  // `/me/portfolio/summary` (see PortfolioSummaryResponse); these per-portfolio
  // copies stay for parity with that endpoint.
  dividendIncome?: number;
  totalReturn?: number;
  totalReturnPercent?: number;
  // ADR-0010: top-level envelope; absent on pre-ADR-0010 backends.
  presentation?: PresentationEnvelope;
};
