"use client";

import { useState } from "react";
import { AssetPriceChart } from "@/components/portfolio/asset-price-chart";
import { useAssetPriceChart } from "@/features/marketdata/hooks/use-asset-price-chart";
import type { AssetPriceRange } from "@/features/marketdata/types/price-history.types";

const RANGES: { label: string; value: AssetPriceRange }[] = [
  { label: "1M", value: "1M" },
  { label: "6M", value: "6M" },
  { label: "1A", value: "1A" },
  { label: "5A", value: "5A" },
];

export function AssetPriceChartContainer({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<AssetPriceRange>("6M");
  const { points, currency, fxRate, loading, error } = useAssetPriceChart(symbol, range);

  return (
    <section className="overflow-hidden rounded-[1.65rem] bg-[#0B0E11] shadow-[0_30px_84px_rgba(0,0,0,0.32)] max-sm:rounded-none">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5 sm:py-4">
        <p className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#71819b]">
          Precio de mercado
        </p>
        <div className="flex items-center gap-2">
          {currency === "MXN" && fxRate ? (
            <span className="rounded-full bg-[#1a1e24] px-2.5 py-1 text-[0.6875rem] font-semibold text-[#e9b872]">
              1 USD = {fxRate.rate.toFixed(2)} MXN
            </span>
          ) : null}
          <div className="flex items-center gap-0.5">
            {RANGES.map((r) => (
              <button
                aria-pressed={range === r.value}
                className={`rounded-lg px-2.5 py-1 text-[0.6875rem] font-semibold transition ${
                  range === r.value ? "bg-[#1a1e24] text-[#16C784]" : "text-[#71819b] hover:text-[#c4cede]"
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
      </div>

      <AssetPriceChart currency={currency} error={error} loading={loading} points={points} />
    </section>
  );
}
