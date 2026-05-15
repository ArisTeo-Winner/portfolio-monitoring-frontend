"use client";

import { useState } from "react";
import { AssetChart } from "@/components/portfolio/asset-chart";
import type { ChartRange } from "@/types/portfolio-chart";

const RANGES: { label: string; value: ChartRange }[] = [
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
  { label: "All", value: "ALL" },
];

export function AssetChartContainer({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<ChartRange>("ALL");

  return (
    <section className="overflow-hidden rounded-[1.65rem] bg-[#0B0E11] shadow-[0_30px_84px_rgba(0,0,0,0.32)] max-sm:rounded-none">
      <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4">
        <p className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#71819b]">
          Precio histórico
        </p>
        <div className="flex items-center gap-0.5">
          {RANGES.map((r) => (
            <button
              aria-pressed={range === r.value}
              className={`rounded-lg px-2.5 py-1 text-[0.6875rem] font-semibold transition ${
                range === r.value
                  ? "bg-[#1a1e24] text-[#16C784]"
                  : "text-[#71819b] hover:text-[#c4cede]"
              }`}
              key={r.value}
              onClick={() => setRange(r.value)}
              type="button"
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <AssetChart symbol={symbol} range={range} />
    </section>
  );
}
