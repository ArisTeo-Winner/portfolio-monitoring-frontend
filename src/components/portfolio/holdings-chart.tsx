"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEventParams, Time } from "lightweight-charts";
import {
  useHoldingsPerformance,
  type HoldingsPerformancePeriod,
} from "@/features/portfolio/api/get-holdings-performance";
import type { HoldingsPerformancePoint } from "@/features/portfolio/types/holdings-performance.types";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";
import { formatCurrency, formatSignedCurrency } from "@/lib/utils/format";

type TooltipState = {
  visible: boolean;
  left: number;
  top: number;
  point: HoldingsPerformancePoint | null;
  value: number;
};

const HISTORY_RANGES: Array<{ key: HoldingsPerformancePeriod; label: string }> = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "ALL", label: "All" },
];

const POSITIVE_COLOR = "#17c784";
const NEGATIVE_COLOR = "#ea3943";
const EMPTY_SERIES: HoldingsPerformancePoint[] = [];
const INITIAL_TOOLTIP_STATE: TooltipState = {
  visible: false,
  left: 0,
  top: 0,
  point: null,
  value: 0,
};

export function HoldingsChart({
  portfolioId,
  entries,
}: {
  portfolioId: string;
  entries: PortfolioEntry[];
}) {
  const [range, setRange] = useState<HoldingsPerformancePeriod>("ALL");
  const { data, error, isLoading } = useHoldingsPerformance(portfolioId, range);
  const [tooltip, setTooltip] = useState<TooltipState>(INITIAL_TOOLTIP_STATE);
  const chartShellRef = useRef<HTMLDivElement | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  const series = useMemo(() => normalizeHoldingsSeries(data?.series ?? EMPTY_SERIES), [data?.series]);
  const lineColor = data?.isProfit ? POSITIVE_COLOR : NEGATIVE_COLOR;
  const allTimeProfit = data?.allTimeProfit ?? 0;
  const costBasis = data?.costBasis ?? 0;
  const profitPercent = costBasis > 0 ? (allTimeProfit / costBasis) * 100 : 0;
  const profitBreakdown = useMemo(() => {
    const profitable = entries.filter((entry) => Number(entry.totalProfitLoss) > 0).length;
    const losing = entries.filter((entry) => Number(entry.totalProfitLoss) < 0).length;
    const flat = entries.length - profitable - losing;
    return { profitable, losing, flat, total: entries.length };
  }, [entries]);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    async function mountChart() {
      if (!chartContainerRef.current || !chartShellRef.current || series.length === 0) {
        setTooltip((previous) => (previous.visible ? { ...previous, visible: false } : previous));
        return;
      }

      const charts = await import("lightweight-charts");
      if (disposed || !chartContainerRef.current || !chartShellRef.current) {
        return;
      }

      const container = chartContainerRef.current;
      const shell = chartShellRef.current;
      container.innerHTML = "";

      const chart = charts.createChart(container, {
        autoSize: true,
        height: 340,
        layout: {
          background: { type: charts.ColorType.Solid, color: "transparent" },
          textColor: "#7f8aa3",
          attributionLogo: false,
        },
        rightPriceScale: {
          borderVisible: false,
          scaleMargins: { top: 0.15, bottom: 0.12 },
        },
        leftPriceScale: { visible: false },
        timeScale: {
          borderVisible: false,
          rightOffset: 2,
          timeVisible: true,
          secondsVisible: false,
          minBarSpacing: 0.35,
        },
        crosshair: {
          mode: charts.CrosshairMode.Normal,
          vertLine: {
            color: "rgba(127,138,163,0.24)",
            width: 1,
            style: charts.LineStyle.Dashed,
            labelVisible: false,
          },
          horzLine: {
            color: "rgba(127,138,163,0.18)",
            width: 1,
            style: charts.LineStyle.Dashed,
            labelVisible: false,
          },
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.02)" },
          horzLines: { color: "rgba(255,255,255,0.04)" },
        },
      });

      const lineSeries = chart.addSeries(charts.LineSeries, {
        color: lineColor,
        lineWidth: 3,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderWidth: 2,
        crosshairMarkerBorderColor: lineColor,
        crosshairMarkerBackgroundColor: "#0d1016",
      });

      lineSeries.setData(
        series.map((point) => ({
          time: point.time as Time,
          value: roundCurrency(point.value),
        })),
      );

      chart.timeScale().fitContent();
      const pointsByTime = buildTimePointMap(series);

      const crosshairHandler = (param: MouseEventParams<Time>) => {
        if (!param.point || typeof param.time !== "number") {
          setTooltip((previous) => (previous.visible ? { ...previous, visible: false } : previous));
          return;
        }

        const mappedPoint = pointsByTime.get(param.time) ?? getNearestPoint(series, param.time);
        if (!mappedPoint) {
          setTooltip((previous) => (previous.visible ? { ...previous, visible: false } : previous));
          return;
        }

        const lineDatum = param.seriesData.get(lineSeries) as { value?: number } | undefined;
        const value = Number(lineDatum?.value ?? mappedPoint.value);
        const left = clamp(param.point.x + 18, 16, shell.clientWidth - 240);
        const top = clamp(param.point.y + 18, 16, shell.clientHeight - 110);

        setTooltip({
          visible: true,
          left,
          top,
          point: mappedPoint,
          value,
        });
      };

      chart.subscribeCrosshairMove(crosshairHandler);
      const resizeObserver = new ResizeObserver(() => chart.timeScale().fitContent());
      resizeObserver.observe(container);

      cleanup = () => {
        resizeObserver.disconnect();
        chart.unsubscribeCrosshairMove(crosshairHandler);
        chart.remove();
      };
    }

    void mountChart();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [lineColor, series]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.82fr)]">
      <article className="overflow-hidden rounded-[1.65rem] bg-[#111317] p-6 shadow-[0_30px_84px_rgba(0,0,0,0.32)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#71819b]">
              Historial de Holdings
            </p>
            <div className="mt-3 flex flex-col gap-1 text-[0.9rem] text-[#8fa0b8] sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
              <span>
                Ganancia historica:{" "}
                <strong className={allTimeProfit >= 0 ? "text-[#17c784]" : "text-[#ea3943]"}>
                  {formatSignedCurrency(allTimeProfit)}{" "}
                  <span className="font-medium">
                    ({profitPercent >= 0 ? "+" : ""}
                    {profitPercent.toFixed(2)}%)
                  </span>
                </strong>
              </span>
              <span>
                Costo base: <strong className="text-white">{formatCurrency(costBasis)}</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {HISTORY_RANGES.map((item) => {
              const active = item.key === range;
              return (
                <button
                  className={`rounded-[0.9rem] px-3.5 py-2 text-[0.82rem] font-semibold transition ${
                    active
                      ? "bg-[#1a1e24] text-white shadow-[0_14px_28px_rgba(0,0,0,0.18)]"
                      : "text-[#7f8aa3] hover:bg-white/[0.04] hover:text-white"
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

        <div className="relative mt-6 overflow-hidden rounded-[1.35rem] bg-[radial-gradient(circle_at_top_left,_rgba(23,199,132,0.16),_transparent_34%),linear-gradient(180deg,#0d1016_0%,#090b10_100%)] px-4 py-4 shadow-[0_20px_42px_rgba(0,0,0,0.24)]">
          {isLoading ? (
            <div className="flex min-h-[22rem] items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#3861fb] border-t-transparent" />
            </div>
          ) : error ? (
            <div className="flex min-h-[22rem] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#15181e] shadow-[0_16px_34px_rgba(0,0,0,0.16)]">
                <ChartLineIcon className="h-8 w-8 text-[#ea3943]" />
              </div>
              <h3 className="mt-5 text-[1.2rem] font-semibold text-white">No fue posible cargar la serie</h3>
              <p className="mt-2 max-w-[34rem] text-[0.9rem] leading-7 text-[#7f8aa3]">
                {error instanceof Error ? error.message : "Ocurrio un error al obtener el historial de holdings."}
              </p>
            </div>
          ) : series.length === 0 ? (
            <div className="flex min-h-[22rem] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#15181e] shadow-[0_16px_34px_rgba(0,0,0,0.16)]">
                <ChartLineIcon className="h-8 w-8 text-[#7f8aa3]" />
              </div>
              <h3 className="mt-5 text-[1.2rem] font-semibold text-white">Aun no hay historial suficiente</h3>
              <p className="mt-2 max-w-[34rem] text-[0.9rem] leading-7 text-[#7f8aa3]">
                Registra transacciones para construir la evolucion real del valor de tu portafolio.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[0.8rem] text-[#8ea0b9]">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: lineColor }}
                />
                <span className="font-medium text-white">Total portfolio value</span>
              </div>

              <div
                className="relative"
                onMouseLeave={() =>
                  setTooltip((previous) => (previous.visible ? { ...previous, visible: false } : previous))
                }
                ref={chartShellRef}
              >
                {tooltip.visible && tooltip.point ? (
                  <div
                    className="pointer-events-none absolute z-10 min-w-[196px] rounded-[1rem] bg-[#13161b]/95 px-4 py-3 shadow-[0_18px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl"
                    style={{ left: tooltip.left, top: tooltip.top }}
                  >
                    <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#7f8aa3]">
                      {formatTooltipDate(tooltip.point.time)}
                    </p>
                    <p className="mt-2 text-[0.98rem] font-semibold text-white">
                      Total Value: {formatCurrency(tooltip.value)}
                    </p>
                  </div>
                ) : null}

                <div className="h-[22rem] w-full" ref={chartContainerRef} />
              </div>
            </div>
          )}
        </div>
      </article>

      <div className="grid gap-4">
        <StatCard
          label="All-time Profit"
          tone={allTimeProfit >= 0 ? "emerald" : "rose"}
          value={formatSignedCurrency(allTimeProfit)}
          subvalue={`${profitPercent >= 0 ? "+" : ""}${profitPercent.toFixed(2)}%`}
        />
        <StatCard label="Cost Basis" tone="neutral" value={formatCurrency(costBasis)} subvalue="Average cost method" />
        <article className="rounded-[1.3rem] bg-[#111317] p-5 shadow-[0_30px_84px_rgba(0,0,0,0.24)]">
          <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#71819b]">Activos en ganancia</p>
          <div className="mt-3 flex items-end gap-2">
            <p className="text-[1.7rem] font-semibold tracking-[-0.05em] text-white">
              {profitBreakdown.profitable}
              <span className="ml-1 text-[1rem] text-[#7f8aa3]">/ {profitBreakdown.total}</span>
            </p>
            <span className="mb-1 rounded-full bg-[#0f2f24] px-2.5 py-1 text-[0.72rem] font-semibold text-[#20d48d]">
              {profitBreakdown.total > 0 ? `${Math.round((profitBreakdown.profitable / profitBreakdown.total) * 100)}%` : "0%"}
            </span>
          </div>
          <p className="mt-2 text-[0.82rem] leading-6 text-[#7f8aa3]">
            {profitBreakdown.losing} {profitBreakdown.losing === 1 ? "activo en perdida" : "activos en perdida"}
            {profitBreakdown.flat > 0 ? ` · ${profitBreakdown.flat} sin cambio` : ""}.
          </p>
        </article>
      </div>
    </div>
  );
}

function buildTimePointMap(points: HoldingsPerformancePoint[]) {
  const lookup = new Map<number, HoldingsPerformancePoint>();
  points.forEach((point) => lookup.set(point.time, point));
  return lookup;
}

function normalizeHoldingsSeries(points: HoldingsPerformancePoint[]) {
  if (points.length <= 1) {
    return points;
  }

  const sorted = [...points].sort((left, right) => left.time - right.time);
  const normalized: HoldingsPerformancePoint[] = [];

  sorted.forEach((point) => {
    const previous = normalized[normalized.length - 1];
    if (previous && previous.time === point.time) {
      normalized[normalized.length - 1] = point;
      return;
    }

    normalized.push(point);
  });

  return normalized;
}

function getNearestPoint(points: HoldingsPerformancePoint[], time: number) {
  if (!points.length) return null;
  let nearest = points[0];
  let distance = Math.abs(points[0].time - time);

  for (let index = 1; index < points.length; index += 1) {
    const nextDistance = Math.abs(points[index].time - time);
    if (nextDistance < distance) {
      nearest = points[index];
      distance = nextDistance;
    }
  }

  return nearest;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function formatTooltipDate(unixTimestamp: number) {
  return new Date(unixTimestamp * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({
  label,
  tone,
  value,
  subvalue,
}: {
  label: string;
  tone: "emerald" | "rose" | "neutral";
  value: string;
  subvalue: string;
}) {
  const valueClass =
    tone === "emerald" ? "text-[#17c784]" : tone === "rose" ? "text-[#ea3943]" : "text-white";

  return (
    <article className="rounded-[1.3rem] bg-[#111317] p-5 shadow-[0_30px_84px_rgba(0,0,0,0.24)]">
      <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#71819b]">{label}</p>
      <p className={`mt-3 text-[1.35rem] font-semibold tracking-[-0.04em] ${valueClass}`}>{value}</p>
      <p className="mt-2 text-[0.82rem] text-[#7f8aa3]">{subvalue}</p>
    </article>
  );
}

function ChartLineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M4 16.5 8.5 12l3 3 7-8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M4 20h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}
