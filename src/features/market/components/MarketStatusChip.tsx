"use client";

import type { ReactElement } from "react";
import { findMarket, useMarketStatus } from "@/features/market/hooks/use-market-status";
import type { MarketCode } from "@/features/market/types/market-status.types";

// Layer 1 — global indicator in the header (replaces the search box), between
// "+ Activo" and the Globe icon. Unified per COUNTRY (macro-region): the retail
// investor doesn't need Wall Street's technical sessions (pre/after), so the chip
// collapses to a single open/closed signal per country — "[MX] MX ● · [US] US ●".
// Green = regular session open; red = closed (after-hours counts as closed here).
// Mini SVG flags (not emoji) so they render consistently on every OS incl. Windows.

const FLAG_CLASS = "h-3 w-[1.125rem] shrink-0 rounded-[2px] ring-1 ring-white/10";

function FlagMX() {
  return (
    <svg aria-hidden="true" className={FLAG_CLASS} viewBox="0 0 18 12">
      <rect fill="#006847" height="12" width="6" x="0" />
      <rect fill="#ffffff" height="12" width="6" x="6" />
      <rect fill="#ce1126" height="12" width="6" x="12" />
    </svg>
  );
}

function FlagUS() {
  return (
    <svg aria-hidden="true" className={FLAG_CLASS} viewBox="0 0 18 12">
      <rect fill="#b22234" height="12" width="18" />
      <rect fill="#ffffff" height="1.4" width="18" y="2" />
      <rect fill="#ffffff" height="1.4" width="18" y="5" />
      <rect fill="#ffffff" height="1.4" width="18" y="8" />
      <rect fill="#ffffff" height="1.4" width="18" y="10.6" />
      <rect fill="#3c3b6e" height="6.4" width="7.6" x="0" y="0" />
    </svg>
  );
}

const REGION: Record<MarketCode, { label: string; Flag: () => ReactElement }> = {
  BMV: { label: "MX", Flag: FlagMX },
  NYSE: { label: "US", Flag: FlagUS },
};

const ORDER: MarketCode[] = ["BMV", "NYSE"];

export function MarketStatusChip({ className = "" }: { className?: string }) {
  const { markets } = useMarketStatus();
  const items = ORDER.map((code) => findMarket(markets, code)).filter(
    (m): m is NonNullable<typeof m> => Boolean(m),
  );
  if (items.length === 0) return null;

  return (
    <div
      aria-label={items.map((m) => `${REGION[m.code].label} ${m.isOpen ? "Abierto" : "Cerrado"}`).join(", ")}
      className={`inline-flex h-10 items-center rounded-xl border border-fintech-border bg-fintech-surface px-3 ${className}`}
      data-testid="market-status-chip"
      role="status"
      aria-live="polite"
    >
      {items.map((m, i) => {
        const open = m.isOpen;
        const region = REGION[m.code];
        return (
          <span className="inline-flex items-center" key={m.code}>
            {i > 0 ? <span className="mx-2 text-fintech-dim">·</span> : null}
            <span
              className={`inline-flex items-center gap-1.5 text-[0.8rem] font-bold ${open ? "text-fintech-positive" : "text-fintech-muted"}`}
              title={`${region.label} (${m.exchange}) · ${open ? "Abierto" : "Cerrado"}`}
            >
              <region.Flag />
              <span>{region.label}</span>
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${open ? "bg-fintech-positive" : "bg-fintech-negative"}`}
              />
            </span>
          </span>
        );
      })}
    </div>
  );
}
