"use client";

import { HoldingsChart } from "@/components/portfolio/holdings-chart";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";

export function PortfolioHoldingsOverview({
  collapsibleOnMobile = false,
  portfolioId,
  entries,
}: {
  collapsibleOnMobile?: boolean;
  portfolioId: string;
  entries: PortfolioEntry[];
}) {
  return <HoldingsChart collapsibleOnMobile={collapsibleOnMobile} entries={entries} portfolioId={portfolioId} />;
}
