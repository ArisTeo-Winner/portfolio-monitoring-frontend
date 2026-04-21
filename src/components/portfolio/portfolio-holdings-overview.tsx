"use client";

import { HoldingsChart } from "@/components/portfolio/holdings-chart";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";

export function PortfolioHoldingsOverview({
  portfolioId,
  entries,
}: {
  portfolioId: string;
  entries: PortfolioEntry[];
}) {
  return <HoldingsChart entries={entries} portfolioId={portfolioId} />;
}
