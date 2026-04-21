"use client";

import { useMemo, useState } from "react";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";
import type { TransactionResponse } from "@/features/transactions/types/transaction.types";
import { formatCurrency, formatQuantity, formatSignedCurrency } from "@/lib/utils/format";

type HistoryRange = "24h" | "7d" | "30d" | "90d" | "historical";
type TimelinePoint = {
  date: Date;
  timestamp: number;
  value: number;
  quantity: number;
  label: string;
};

const HISTORY_RANGES: { key: HistoryRange; label: string; ms: number | null }[] = [
  { key: "24h", label: "24h", ms: 24 * 60 * 60 * 1000 },
  { key: "7d", label: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "30d", label: "30d", ms: 30 * 24 * 60 * 60 * 1000 },
  { key: "90d", label: "90d", ms: 90 * 24 * 60 * 60 * 1000 },
  { key: "historical", label: "Historico", ms: null },
];

const VIEWBOX_WIDTH = 920;
const VIEWBOX_HEIGHT = 360;
const CHART_PADDING = { top: 24, right: 18, bottom: 48, left: 76 };

export function HoldingHistoryChart({
  entry,
  transactions,
}: {
  entry: PortfolioEntry;
  transactions: TransactionResponse[];
}) {
  const [range, setRange] = useState<HistoryRange>("historical");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const allPoints = useMemo(() => buildHoldingTimeline(entry, transactions), [entry, transactions]);
  const visiblePoints = useMemo(() => filterTimelineByRange(allPoints, range), [allPoints, range]);
  const chartState = useMemo(() => buildChartState(visiblePoints), [visiblePoints]);
  const hasHistoricalData = allPoints.length > 1 && transactions.length > 0;

  const historicalGain = Number(entry.totalProfitLoss);
  const baseCost = Number(entry.totalInvested);
  const historicalPercent = baseCost > 0 ? (historicalGain / baseCost) * 100 : 0;
  const activePointIndex = hoveredIndex ?? Math.max(0, chartState.points.length - 1);
  const activePoint = chartState.points[activePointIndex];

  return (
    <section className="overflow-hidden rounded-[1.65rem] bg-[#111317] p-6 shadow-[inset_0_0_0_1px_#171a1f,0_28px_90px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[0.74rem] font-medium uppercase tracking-[0.24em] text-[#17c784]">Comparacion temporal</p>
          <h2 className="mt-3 text-[1.75rem] font-semibold tracking-[-0.05em] text-white">Historial de Holdings</h2>
          <div className="mt-3 flex flex-col gap-2 text-[0.94rem] sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
            <span className={historicalGain >= 0 ? "font-semibold text-[#22c55e]" : "font-semibold text-[#ff6b6b]"}>
              Ganancia historica: {formatSignedCurrency(historicalGain)} ({historicalPercent >= 0 ? "+" : ""}
              {historicalPercent.toFixed(2)}%)
            </span>
            <span className="font-medium text-[#8fa0b8]">Costo base: {formatCurrency(baseCost)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {HISTORY_RANGES.map((item) => {
            const active = item.key === range;
            return (
              <button
                className={`rounded-[0.9rem] px-3.5 py-2 text-[0.82rem] font-semibold transition ${
                  active ? "bg-[#1a1e24] text-white shadow-[inset_0_0_0_1px_#232833]" : "text-[#7f8aa3] hover:bg-white/[0.04] hover:text-white"
                }`}
                key={item.key}
                onClick={() => setRange(item.key)}
                type="button"
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-[1.4rem] bg-[#0d0f13] p-5 shadow-[inset_0_0_0_1px_#171a1f]">
        {hasHistoricalData ? (
          <div className="space-y-4">
            <div className="relative">
              {activePoint ? (
                <div
                  className="pointer-events-none absolute z-10 rounded-[1rem] bg-[#13161b] px-4 py-3 shadow-[inset_0_0_0_1px_#20242c,0_16px_34px_rgba(0,0,0,0.28)]"
                  style={{
                    left: `clamp(12px, calc(${(activePoint.x / VIEWBOX_WIDTH) * 100}% - 96px), calc(100% - 220px))`,
                    top: `clamp(8px, calc(${(activePoint.y / VIEWBOX_HEIGHT) * 100}% - 86px), calc(100% - 88px))`,
                  }}
                >
                  <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#7f8aa3]">{formatTooltipDate(activePoint.data.date)}</p>
                  <p className="mt-2 text-[0.98rem] font-semibold text-white">Total Value: {formatCurrency(activePoint.data.value)}</p>
                  <p className="mt-1 text-[0.8rem] text-[#8fa0b8]">
                    Holdings: {formatQuantity(activePoint.data.quantity)} {entry.assetSymbol}
                  </p>
                </div>
              ) : null}

              <svg
                aria-hidden="true"
                className="h-[23rem] w-full"
                onMouseLeave={() => setHoveredIndex(null)}
                preserveAspectRatio="none"
                viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
              >
                <defs>
                  <linearGradient id="holdingAreaFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#17c784" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#17c784" stopOpacity="0.02" />
                  </linearGradient>
                  <linearGradient id="holdingLineStroke" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#16a34a" />
                  </linearGradient>
                </defs>

                {chartState.yTicks.map((tick) => (
                  <g key={`y-${tick.value}`}>
                    <line stroke="#171a1f" strokeDasharray="4 8" x1={CHART_PADDING.left} x2={VIEWBOX_WIDTH - CHART_PADDING.right} y1={tick.y} y2={tick.y} />
                    <text fill="#667085" fontSize="12" textAnchor="start" x="0" y={tick.y + 4}>
                      {formatCompactCurrency(tick.value)}
                    </text>
                  </g>
                ))}

                {chartState.xTicks.map((tick) => (
                  <g key={`x-${tick.label}-${tick.x}`}>
                    <text fill="#667085" fontSize="12" textAnchor="middle" x={tick.x} y={VIEWBOX_HEIGHT - 14}>
                      {tick.label}
                    </text>
                  </g>
                ))}

                <path d={`${toPath(chartState.points)} L ${VIEWBOX_WIDTH - CHART_PADDING.right} ${VIEWBOX_HEIGHT - CHART_PADDING.bottom} L ${CHART_PADDING.left} ${VIEWBOX_HEIGHT - CHART_PADDING.bottom} Z`} fill="url(#holdingAreaFill)" />
                <path d={toPath(chartState.points)} fill="none" stroke="url(#holdingLineStroke)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.2" />

                {chartState.points.map((point, index) => {
                  const active = index === activePointIndex;
                  return (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      fill={active ? "#0d1117" : "#17c784"}
                      key={`${point.x}-${point.y}-${index}`}
                      onMouseEnter={() => setHoveredIndex(index)}
                      r={active ? 5.2 : 3.2}
                      stroke="#17c784"
                      strokeWidth={active ? 2.3 : 0}
                    />
                  );
                })}

                <rect
                  fill="transparent"
                  height={VIEWBOX_HEIGHT}
                  onMouseMove={(event) => {
                    const svg = event.currentTarget.ownerSVGElement;
                    if (!svg) return;
                    const rect = svg.getBoundingClientRect();
                    const relativeX = ((event.clientX - rect.left) / rect.width) * VIEWBOX_WIDTH;
                    let nearestIndex = 0;
                    let nearestDistance = Number.POSITIVE_INFINITY;

                    chartState.points.forEach((point, index) => {
                      const distance = Math.abs(point.x - relativeX);
                      if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestIndex = index;
                      }
                    });

                    setHoveredIndex(nearestIndex);
                  }}
                  width={VIEWBOX_WIDTH}
                  x="0"
                  y="0"
                />
              </svg>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[23rem] flex-col items-center justify-center rounded-[1.2rem] bg-[#111317] px-6 text-center shadow-[inset_0_0_0_1px_#171a1f]">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#15181e] shadow-[inset_0_0_0_1px_#1c2028]">
              <ChartLineIcon className="h-8 w-8 text-[#7f8aa3]" />
            </div>
            <h3 className="mt-5 text-[1.2rem] font-semibold text-white">No hay suficiente historial todavia</h3>
            <p className="mt-2 max-w-[34rem] text-[0.9rem] leading-7 text-[#7f8aa3]">
              Registra mas operaciones para desbloquear la evolucion temporal de este holding con comparacion por rango.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function buildHoldingTimeline(entry: PortfolioEntry, transactions: TransactionResponse[]) {
  const ordered = [...transactions]
    .filter((transaction) => !Number.isNaN(new Date(transaction.transactionDate).getTime()))
    .sort((left, right) => new Date(left.transactionDate).getTime() - new Date(right.transactionDate).getTime());

  if (!ordered.length) {
    return [];
  }

  let quantity = 0;
  const points: TimelinePoint[] = ordered.map((transaction) => {
    const transactionQuantity = Math.abs(Number(transaction.quantity) || 0);
    const transactionPrice = Number(transaction.pricePerUnit) || 0;

    if (transaction.transactionType === "SELL") {
      quantity = Math.max(0, quantity - transactionQuantity);
    } else {
      quantity += transactionQuantity;
    }

    const date = new Date(transaction.transactionDate);
    const value = Math.max(0, quantity * transactionPrice);

    return {
      date,
      timestamp: date.getTime(),
      value,
      quantity,
      label: transaction.transactionType,
    };
  });

  const latestPoint = points[points.length - 1];
  const currentTimestamp = Date.now();
  const currentValue = Math.max(0, Number(entry.currentValue) || 0);
  const currentQuantity = Math.max(0, Number(entry.totalQuantity) || latestPoint.quantity);

  if (currentTimestamp > latestPoint.timestamp) {
    points.push({
      date: new Date(currentTimestamp),
      timestamp: currentTimestamp,
      value: currentValue,
      quantity: currentQuantity,
      label: "CURRENT",
    });
  } else {
    points[points.length - 1] = {
      ...latestPoint,
      value: currentValue,
      quantity: currentQuantity,
      label: "CURRENT",
    };
  }

  return densifyTimeline(points);
}

function densifyTimeline(points: TimelinePoint[]) {
  if (points.length <= 1) {
    return points;
  }

  const dense: TimelinePoint[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    dense.push(start);

    const gap = end.timestamp - start.timestamp;
    const segments = gap > 120 * 24 * 60 * 60 * 1000 ? 5 : gap > 45 * 24 * 60 * 60 * 1000 ? 3 : 1;

    for (let step = 1; step < segments; step += 1) {
      const ratio = step / segments;
      const easedRatio = 0.5 - Math.cos(Math.PI * ratio) / 2;
      const timestamp = start.timestamp + gap * ratio;
      const value = start.value + (end.value - start.value) * easedRatio;
      const quantity = start.quantity + (end.quantity - start.quantity) * ratio;

      dense.push({
        date: new Date(timestamp),
        timestamp,
        value,
        quantity,
        label: "INTERPOLATED",
      });
    }
  }

  dense.push(points[points.length - 1]);
  return dense;
}

function filterTimelineByRange(points: TimelinePoint[], range: HistoryRange) {
  if (!points.length) {
    return points;
  }

  const definition = HISTORY_RANGES.find((item) => item.key === range);
  if (!definition || definition.ms === null) {
    return points;
  }

  const cutoff = Date.now() - definition.ms;
  const firstVisibleIndex = points.findIndex((point) => point.timestamp >= cutoff);

  if (firstVisibleIndex <= 0) {
    return points;
  }

  const previousPoint = points[firstVisibleIndex - 1];
  const visiblePoints = points.slice(firstVisibleIndex);
  return [previousPoint, ...visiblePoints];
}

function buildChartState(points: TimelinePoint[]) {
  if (!points.length) {
    return {
      points: [] as Array<{ x: number; y: number; data: TimelinePoint }>,
      yTicks: [] as Array<{ value: number; y: number }>,
      xTicks: [] as Array<{ label: string; x: number }>,
    };
  }

  const minValue = Math.min(...points.map((point) => point.value));
  const maxValue = Math.max(...points.map((point) => point.value));
  const yPadding = Math.max(120, (maxValue - minValue || maxValue || 1) * 0.16);
  const yDomainMin = Math.max(0, minValue - yPadding);
  const yDomainMax = maxValue + yPadding;

  const minTime = points[0].timestamp;
  const maxTime = points[points.length - 1].timestamp;
  const timeSpan = Math.max(1, maxTime - minTime);
  const innerWidth = VIEWBOX_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const innerHeight = VIEWBOX_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  const projectedPoints = points.map((point) => ({
    x: CHART_PADDING.left + ((point.timestamp - minTime) / timeSpan) * innerWidth,
    y:
      VIEWBOX_HEIGHT -
      CHART_PADDING.bottom -
      ((point.value - yDomainMin) / Math.max(1, yDomainMax - yDomainMin)) * innerHeight,
    data: point,
  }));

  const yTicks = Array.from({ length: 4 }, (_, index) => {
    const value = yDomainMin + ((yDomainMax - yDomainMin) / 3) * index;
    const y =
      VIEWBOX_HEIGHT -
      CHART_PADDING.bottom -
      ((value - yDomainMin) / Math.max(1, yDomainMax - yDomainMin)) * innerHeight;
    return { value, y };
  }).reverse();

  const xTicks = Array.from({ length: Math.min(5, points.length) }, (_, index) => {
    const ratio = Math.min(1, index / Math.max(1, Math.min(4, points.length - 1)));
    const tickTime = minTime + timeSpan * ratio;
    const x = CHART_PADDING.left + ratio * innerWidth;
    return {
      label: formatAxisDate(new Date(tickTime)),
      x,
    };
  });

  return { points: projectedPoints, yTicks, xTicks };
}

function toPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) {
    return "";
  }

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function formatTooltipDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAxisDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: date.getMonth() === 0 ? "numeric" : undefined,
  });
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(value);
}

function ChartLineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M4 16.5 8.5 12l3 3 7-8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M4 20h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}
