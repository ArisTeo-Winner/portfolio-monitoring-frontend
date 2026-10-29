"use client";

import { findMarket, useMarketStatus } from "@/features/market/hooks/use-market-status";
import { phaseLabel, toneOf, type MarketCode, type StatusTone } from "@/features/market/types/market-status.types";

// Layer 2 — contextual anchor embedded in data widgets (holdings rows, transaction
// rows, dashboard tiles). Reads the SAME shared store as the header chip, so there is
// a single source of truth with two presentations. Fintech Density: text-[10px].

const TEXT: Record<StatusTone, string> = {
  open: "text-fintech-positive",
  extended: "text-amber-400",
  closed: "text-fintech-muted",
};
const DOT: Record<StatusTone, string> = {
  open: "bg-fintech-positive",
  extended: "bg-amber-400",
  closed: "bg-fintech-negative",
};

export function MarketStatusAnchor({
  code,
  compact = false,
  className = "",
}: {
  code: MarketCode;
  /** Show only the phase word (no market code). */
  compact?: boolean;
  className?: string;
}) {
  const { markets } = useMarketStatus();
  const market = findMarket(markets, code);
  if (!market) return null;

  const tone = toneOf(market.phase);
  const word = phaseLabel(market.phase);

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold ${TEXT[tone]} ${className}`}
      data-testid="market-status-anchor"
      title={`${market.label} · ${word}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      {compact ? word : `${code} · ${word}`}
    </span>
  );
}

/** Maps an instrument to its market. USD → NYSE; MXN / SIC → BMV. */
export function marketOf(currency: string | null | undefined): MarketCode {
  return (currency ?? "").trim().toUpperCase() === "MXN" ? "BMV" : "NYSE";
}
