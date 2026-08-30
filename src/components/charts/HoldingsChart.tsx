"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEventParams, Time } from "lightweight-charts";
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import {
  type HoldingsPerformancePeriod,
  useHoldingsPerformance,
} from "@/features/portfolio/api/get-holdings-performance";
import type {
  HoldingsPerformancePoint,
  HoldingsPerformanceResponse,
} from "@/features/portfolio/types/holdings-performance.types";
import { formatCurrency } from "@/lib/utils/format";

type HoldingsChartProps = {
  portfolioId: string;
  period?: HoldingsPerformancePeriod;
};

type TooltipState = {
  visible: boolean;
  left: number;
  top: number;
  point: HoldingsPerformancePoint | null;
};

const PERIOD_OPTIONS: Array<{ value: HoldingsPerformancePeriod; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "ALL", label: "All" },
];

const PROFIT_COLOR = "#17c784";
const LOSS_COLOR = "#ea3943";
const INITIAL_TOOLTIP_STATE: TooltipState = {
  visible: false,
  left: 0,
  top: 0,
  point: null,
};

export function HoldingsChart({ portfolioId, period = "ALL" }: HoldingsChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<HoldingsPerformancePeriod>(period);
  const [tooltip, setTooltip] = useState<TooltipState>(INITIAL_TOOLTIP_STATE);
  const chartShellRef = useRef<HTMLDivElement | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    handleResize(); // Initialize on mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setSelectedPeriod(period);
  }, [period]);

  const { data, error, isError, isLoading, isFetching } = useHoldingsPerformance(portfolioId, selectedPeriod);
  const lineColor = data?.isProfit ? PROFIT_COLOR : LOSS_COLOR;
  const normalizedData = useMemo(() => {
    if (!data) return null;
    return {
      ...data,
      series: normalizeHoldingsSeries(data.series),
    };
  }, [data]);
  const pointsByTime = useMemo(() => buildPointMap(normalizedData?.series ?? []), [normalizedData?.series]);

  useEffect(() => {
    let disposed = false;
    let cleanupChart: (() => void) | undefined;

    async function mountChart(payload: HoldingsPerformanceResponse) {
      if (isMobile || !chartContainerRef.current || !chartShellRef.current || payload.series.length === 0) {
        setTooltip(INITIAL_TOOLTIP_STATE);
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
        height: 320,
        layout: {
          background: { type: charts.ColorType.Solid, color: "transparent" },
          textColor: "#94a3b8",
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: "rgba(148,163,184,0.08)" },
          horzLines: { color: "rgba(148,163,184,0.08)" },
        },
        leftPriceScale: {
          visible: false,
        },
        rightPriceScale: {
          borderVisible: false,
          mode: charts.PriceScaleMode.Logarithmic,
        },
        timeScale: {
          borderVisible: false,
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: {
          vertLine: {
            labelVisible: false,
            color: "rgba(148,163,184,0.24)",
          },
          horzLine: {
            labelVisible: false,
            color: "rgba(148,163,184,0.18)",
          },
        },
      });

      const lineSeries = chart.addSeries(charts.LineSeries, {
        color: payload.isProfit ? PROFIT_COLOR : LOSS_COLOR,
        lineWidth: 3,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerBorderColor: payload.isProfit ? PROFIT_COLOR : LOSS_COLOR,
        crosshairMarkerBackgroundColor: "#0b1120",
      });

      lineSeries.setData(payload.series.map((point) => ({ time: point.time as Time, value: point.value })));
      chart.timeScale().fitContent();

      const crosshairHandler = (param: MouseEventParams<Time>) => {
        if (!param.point || typeof param.time !== "number") {
          setTooltip(INITIAL_TOOLTIP_STATE);
          return;
        }

        const activePoint = pointsByTime.get(param.time) ?? null;
        if (!activePoint) {
          setTooltip(INITIAL_TOOLTIP_STATE);
          return;
        }

        setTooltip({
          visible: true,
          left: clamp(param.point.x + 18, 12, Math.max(12, shell.clientWidth - 220)),
          top: clamp(param.point.y + 18, 12, Math.max(12, shell.clientHeight - 88)),
          point: activePoint,
        });
      };

      chart.subscribeCrosshairMove(crosshairHandler);

      const resizeObserver = new ResizeObserver(() => {
        chart.timeScale().fitContent();
      });
      resizeObserver.observe(container);

      cleanupChart = () => {
        resizeObserver.disconnect();
        chart.unsubscribeCrosshairMove(crosshairHandler);
        chart.remove();
      };
    }

    if (normalizedData) {
      void mountChart(normalizedData);
    } else if (chartContainerRef.current) {
      chartContainerRef.current.innerHTML = "";
      setTooltip(INITIAL_TOOLTIP_STATE);
    }

    return () => {
      disposed = true;
      cleanupChart?.();
    };
  }, [normalizedData, pointsByTime, isMobile]);

  const rechartsData = useMemo(() => {
    if (!isMobile || !normalizedData) return [];
    return normalizedData.series.map((point) => ({
      time: point.time * 1000,
      value: point.value,
    }));
  }, [normalizedData, isMobile]);

  return (
    <section className="rounded-[1.4rem] bg-[#101216] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-4 border-b border-[#1b1f26] pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Holdings</h2>
          <p className="mt-1 text-sm text-[#8b96a8]">Serie exacta devuelta por el backend.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_OPTIONS.map((option) => {
            const active = option.value === selectedPeriod;
            return (
              <button
                aria-pressed={active}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  active ? "bg-[#1d4ed8] text-white" : "bg-[#171a20] text-[#94a3b8] hover:text-white"
                }`}
                key={option.value}
                onClick={() => setSelectedPeriod(option.value)}
                type="button"
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[22rem] items-center justify-center text-sm text-[#94a3b8]">
          Loading holdings history...
        </div>
      ) : isError ? (
        <div className="flex min-h-[22rem] items-center justify-center text-sm text-[#f87171]">
          {error instanceof Error ? error.message : "Unable to load holdings history."}
        </div>
      ) : !normalizedData?.series.length ? (
        <div className="flex min-h-[22rem] items-center justify-center text-sm text-[#94a3b8]">
          No holdings history found for this portfolio.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm text-[#94a3b8]">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lineColor }} />
              <span>{normalizedData?.isProfit ? "In profit" : "Under water"}</span>
            </span>
            <span>All-time Profit: {formatCurrency(normalizedData?.allTimeProfit ?? 0)}</span>
            <span>Cost Basis: {formatCurrency(normalizedData?.costBasis ?? 0)}</span>
            {isFetching ? <span className="text-[#60a5fa]">Refreshing...</span> : null}
          </div>

          <div
            className="relative"
            onMouseLeave={() => setTooltip(INITIAL_TOOLTIP_STATE)}
            ref={chartShellRef}
          >
            {isMobile ? (
              <div className="h-[22rem] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={rechartsData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValueAlt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={lineColor} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" domain={["dataMin", "dataMax"]} hide type="number" />
                    <YAxis domain={["auto", "auto"]} hide />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-xl bg-[#0f172a] px-4 py-3 text-sm shadow-[0_16px_36px_rgba(0,0,0,0.36)]">
                              <p className="font-medium text-white">{formatChartDate(data.time / 1000)}</p>
                              <p className="mt-1 text-[#cbd5e1]">Total Value: {formatCurrency(data.value)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      dataKey="value"
                      fill="url(#colorValueAlt)"
                      fillOpacity={1}
                      stroke={lineColor}
                      strokeWidth={3}
                      type="monotone"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <>
                {tooltip.visible && tooltip.point ? (
                  <div
                    className="pointer-events-none absolute z-10 min-w-[210px] rounded-xl bg-[#0f172a] px-4 py-3 text-sm shadow-[0_16px_36px_rgba(0,0,0,0.36)]"
                    data-testid="holdings-chart-tooltip"
                    style={{ left: tooltip.left, top: tooltip.top }}
                  >
                    <p className="font-medium text-white">{formatChartDate(tooltip.point.time)}</p>
                    <p className="mt-1 text-[#cbd5e1]">Total Value: {formatCurrency(tooltip.point.value)}</p>
                  </div>
                ) : null}

                <div className="h-[22rem] w-full" ref={chartContainerRef} />
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function buildPointMap(series: HoldingsPerformancePoint[]) {
  return new Map(series.map((point) => [point.time, point]));
}

function normalizeHoldingsSeries(series: HoldingsPerformancePoint[]) {
  if (series.length <= 1) {
    return series;
  }

  const sorted = [...series].sort((left, right) => left.time - right.time);
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatChartDate(unixTimestamp: number) {
  return new Date(unixTimestamp * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
