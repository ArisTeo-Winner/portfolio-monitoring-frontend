export type HoldingsPerformancePoint = {
  time: number;
  value: number;
};

import type { PresentationEnvelope } from "@/features/portfolio/types/presentation.types";

export type HoldingsPerformanceResponse = {
  series: HoldingsPerformancePoint[];
  isProfit: boolean;
  allTimeProfit: number;
  costBasis: number;
  // ADR-0010: top-level envelope; absent on pre-ADR-0010 backends.
  presentation?: PresentationEnvelope;
};
