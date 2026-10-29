"use client";

import type { HistoryRange } from "../types";

const RANGES: { label: string; value: HistoryRange }[] = [
  { label: "24H", value: "24h" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "Todo", value: "all" },
];

export function ChartToolbar({
  active,
  onChange,
}: {
  active: HistoryRange;
  onChange: (range: HistoryRange) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {RANGES.map((r) => (
        <button
          aria-pressed={active === r.value}
          className={`rounded-lg px-2.5 py-1 text-[0.6875rem] font-semibold transition ${
            active === r.value
              ? "bg-fintech-active text-fintech-positive"
              : "text-fintech-muted hover:text-[#c4cede]"
          }`}
          key={r.value}
          onClick={() => onChange(r.value)}
          type="button"
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
