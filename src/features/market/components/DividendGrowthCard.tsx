"use client";

import { useMemo } from "react";
import { useDividendGrowth } from "@/features/market/hooks/use-dividend-growth";

const HORIZONS = [
  { key: "cagr1y", label: "1A" },
  { key: "cagr3y", label: "3A" },
  { key: "cagr5y", label: "5A" },
  { key: "cagr10y", label: "10A" },
] as const;

// Dividend-growth panel for a single holding. CAGR values arrive as FRACTIONS
// (0.0734 = 7.34%). The whole section self-hides for assets with no dividend
// history, so it never shows an empty card on non-dividend holdings.
export function DividendGrowthCard({ symbol }: { symbol: string }) {
  const { data } = useDividendGrowth(symbol);

  const recent = useMemo(() => {
    const years = [...(data?.annualDividends ?? [])].sort((a, b) => a.year - b.year);
    return years.slice(-6);
  }, [data?.annualDividends]);

  if (!data) return null;
  const hasCagr = HORIZONS.some((horizon) => data[horizon.key] != null);
  if (!hasCagr && recent.length === 0) return null;

  const maxDps = recent.reduce((max, point) => Math.max(max, point.totalDps), 0);
  const latest = recent.at(-1);

  return (
    <section className="border-t border-[#1a1f29]">
      <div className="flex items-center justify-between border-b border-[#1a1f29] px-6 py-3">
        <span className="text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-[#74829a]">
          Crecimiento de dividendos
        </span>
        <span className="text-[0.72rem] text-fintech-muted">CAGR del dividendo por acción (DPS)</span>
      </div>

      <div className="px-6 py-5">
        <div className="grid grid-cols-4 gap-2.5">
          {HORIZONS.map((horizon) => (
            <CagrChip key={horizon.key} label={horizon.label} fraction={data[horizon.key]} />
          ))}
        </div>

        {recent.length ? (
          <div className="mt-5">
            <div className="flex items-end justify-between gap-1.5" style={{ height: "3.25rem" }}>
              {recent.map((point) => {
                const height = maxDps > 0 ? Math.max(6, Math.round((point.totalDps / maxDps) * 100)) : 6;
                return (
                  <div className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5" key={point.year}>
                    <span
                      className="w-full rounded-t-[0.3rem] bg-gradient-to-t from-[#0f9e67] to-[#1fd38b]"
                      style={{ height: `${height}%` }}
                      title={`${point.year}: ${point.totalDps} DPS`}
                    />
                    <span className="text-[0.62rem] tabular-nums text-fintech-dim">{`'${String(point.year).slice(-2)}`}</span>
                  </div>
                );
              })}
            </div>
            {latest ? (
              <p className="mt-3 text-[0.74rem] text-fintech-muted">
                DPS {latest.year}:{" "}
                <span className="font-semibold tabular-nums text-white">
                  {latest.totalDps}
                  {data.currency ? ` ${data.currency}` : ""}
                </span>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CagrChip({ label, fraction }: { label: string; fraction: number | null }) {
  const available = fraction != null;
  const percent = available ? fraction * 100 : 0;
  const tone = !available ? "text-fintech-dim" : percent >= 0 ? "text-fintech-positive" : "text-fintech-negative";
  return (
    <div className="rounded-[0.85rem] bg-[#10141a] px-2.5 py-2.5 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
      <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-fintech-dim">{label}</p>
      <p className={`mt-1 text-[0.98rem] font-semibold tabular-nums ${tone}`}>
        {available ? `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%` : "—"}
      </p>
    </div>
  );
}
