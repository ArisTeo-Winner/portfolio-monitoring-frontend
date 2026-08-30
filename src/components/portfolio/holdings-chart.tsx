"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LogicalRange, MouseEventParams, Time } from "lightweight-charts";
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { ChevronDown } from "lucide-react";
import { usePortfolioHistory } from "@/features/portfolio/hooks/usePortfolioHistory";
import type { PortfolioHistoryPoint } from "@/features/portfolio/types/portfolio-history.types";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";
import { filterSeriesByRange } from "@/features/portfolio/lib/range-utils";
import { tokens } from "@/lib/design-tokens";
import { formatCurrency, formatSignedCurrency } from "@/lib/utils/format";

type HistoryRange = "24h" | "7d" | "30d" | "90d" | "ALL";

type TooltipState = {
  visible: boolean;
  left: number;
  top: number;
  point: PortfolioHistoryPoint | null;
  value: number;
};

const RANGE_ORDER: HistoryRange[] = ["24h", "7d", "30d", "90d", "ALL"];

function getNextRange(current: HistoryRange): HistoryRange | null {
  const idx = RANGE_ORDER.indexOf(current);
  return idx < RANGE_ORDER.length - 1 ? RANGE_ORDER[idx + 1] : null;
}

const HISTORY_RANGES: Array<{ key: HistoryRange; label: string }> = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "ALL", label: "All" },
];

const POSITIVE_COLOR = tokens.positive;
const NEGATIVE_COLOR = tokens.negative;
const EMPTY_SERIES: PortfolioHistoryPoint[] = [];
const INITIAL_TOOLTIP_STATE: TooltipState = {
  visible: false,
  left: 0,
  top: 0,
  point: null,
  value: 0,
};

export function HoldingsChart({
  collapsibleOnMobile = false,
  portfolioId,
  entries,
}: {
  collapsibleOnMobile?: boolean;
  portfolioId?: string;
  entries: PortfolioEntry[];
}) {
  const [range, setRange] = useState<HistoryRange>("ALL");
  const [scaleMode, setScaleMode] = useState<"linear" | "log">("linear");
  const [isChartExpanded, setIsChartExpanded] = useState(true);
  const { data, error, isLoading } = usePortfolioHistory(range, portfolioId);
  const [tooltip, setTooltip] = useState<TooltipState>(INITIAL_TOOLTIP_STATE);
  const chartShellRef = useRef<HTMLDivElement | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const rangeRef = useRef<HistoryRange>(range);
  useEffect(() => {
    rangeRef.current = range;
  }, [range]);
  const lastExpansionRef = useRef(0);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const totalValue = useMemo(() => entries.reduce((acc, entry) => acc + Number(entry.currentValue), 0), [entries]);
  const [nowSeconds, setNowSeconds] = useState(0);
  useEffect(() => {
    setNowSeconds(Math.floor(Date.now() / 1000));
  }, [data]);

  const series = useMemo<PortfolioHistoryPoint[]>(() => {
    const raw = filterSeriesByRange(data?.series ?? EMPTY_SERIES, range, nowSeconds > 0 ? nowSeconds : undefined);
    if (nowSeconds > 0 && raw.length > 0 && totalValue > 0 && nowSeconds > raw[raw.length - 1].time) {
      return [...raw, { time: nowSeconds, value: totalValue }];
    }
    return raw;
  }, [data?.series, range, totalValue, nowSeconds]);
  const firstNonZero = series.find((p) => p.value > 0);
  const allTimeProfit = useMemo(() => entries.reduce((acc, entry) => acc + Number(entry.totalProfitLoss), 0), [entries]);
  const costBasis = useMemo(() => entries.reduce((acc, entry) => acc + Number(entry.totalInvested), 0), [entries]);
  // Color based on all-time profit/loss from entries (cost basis vs current value),
  // not on the historical series comparison which can be misleading when the
  // first non-zero point is a small early position.
  const isProfit = allTimeProfit >= 0;
  const lineColor = isProfit ? POSITIVE_COLOR : NEGATIVE_COLOR;
  const profitPercent = costBasis > 0 ? (allTimeProfit / costBasis) * 100 : 0;
  const profitBreakdown = useMemo(() => {
    const profitable = entries.filter((entry) => Number(entry.totalProfitLoss) > 0).length;
    const losing = entries.filter((entry) => Number(entry.totalProfitLoss) < 0).length;
    const flat = entries.length - profitable - losing;
    return { profitable, losing, flat, total: entries.length };
  }, [entries]);

  const toggleChart = () => {
    setIsChartExpanded((current) => !current);
  };

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    async function mountChart() {
      if (isMobile || !chartContainerRef.current || !chartShellRef.current || series.length === 0) {
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
        layout: {
          background: { type: charts.ColorType.Solid, color: "transparent" },
          textColor: tokens.muted,
          attributionLogo: false,
        },
        rightPriceScale: {
          borderVisible: false,
          scaleMargins: { top: 0.1, bottom: 0 },
          autoScale: true,
          mode: scaleMode === "log" ? charts.PriceScaleMode.Logarithmic : charts.PriceScaleMode.Normal,
        },
        leftPriceScale: { visible: false },
        timeScale: {
          borderVisible: false,
          rightOffset: 5,
          timeVisible: true,
          secondsVisible: false,
          minBarSpacing: 0.5,
          lockVisibleTimeRangeOnResize: true,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        handleScale: {
          axisPressedMouseMove: {
            time: true,
            price: true,
          },
          mouseWheel: true,
          pinch: true,
        },
        kineticScroll: {
          touch: true,
          mouse: false,
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
        crosshairMarkerBackgroundColor: tokens.deep,
      });

      // CoinMarketCap style: draw only from the first non-zero point so the
      // Y-axis scales tightly around real values, but expand the visible time
      // range to cover the full API span (blank space before the curve starts).
      const firstRealIdx = series.findIndex((p) => p.value > 0);
      const drawPoints = firstRealIdx > 0 ? series.slice(firstRealIdx) : series;

      lineSeries.setData(
        drawPoints.map((point) => ({
          time: point.time as Time,
          value: roundCurrency(point.value),
        })),
      );

      // fitContent() sobre drawPoints (ya sin ceros iniciales) — eje Y escala
      // sobre valores reales sin saltos prominentes desde $0.
      const setFullRange = () => {
        chart.timeScale().fitContent();
      };
      setFullRange();

      if (drawPoints.length > 0) {
        const lastValue = roundCurrency(drawPoints[drawPoints.length - 1].value);
        const prevValue =
          drawPoints.length > 1
            ? drawPoints[drawPoints.length - 2].value
            : lastValue;
        const tickUp = lastValue >= prevValue;
        const markerColor = tickUp ? POSITIVE_COLOR : NEGATIVE_COLOR;

        lineSeries.createPriceLine({
          price: lastValue,
          color: markerColor,
          lineWidth: 1,
          lineStyle: charts.LineStyle.Dashed,
          axisLabelVisible: true,
          axisLabelColor: markerColor,
          axisLabelTextColor: "#ffffff",
          title: "",
        });
      }

      const handleLogicalRangeChange = (logicalRange: LogicalRange | null) => {
        if (!logicalRange || logicalRange.from >= -0.5) return;
        if (Date.now() - lastExpansionRef.current < 1500) return;
        const next = getNextRange(rangeRef.current);
        if (next) {
          lastExpansionRef.current = Date.now();
          setRange(next);
        }
      };
      chart.timeScale().subscribeVisibleLogicalRangeChange(handleLogicalRangeChange);

      const pointsByTime = buildTimePointMap(drawPoints);

      const crosshairHandler = (param: MouseEventParams<Time>) => {
        if (!param.point || typeof param.time !== "number") {
          setTooltip((previous) => (previous.visible ? { ...previous, visible: false } : previous));
          return;
        }

        const mappedPoint = pointsByTime.get(param.time) ?? getNearestPoint(drawPoints, param.time);
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
      const resizeObserver = new ResizeObserver(() => setFullRange());
      resizeObserver.observe(container);

      cleanup = () => {
        resizeObserver.disconnect();
        chart.unsubscribeCrosshairMove(crosshairHandler);
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleLogicalRangeChange);
        chart.remove();
      };
    }

    void mountChart();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [lineColor, series, isMobile, scaleMode]);

  const rechartsData = useMemo(() => {
    if (!isMobile) return [];
    return series.map((point) => ({
      time: point.time * 1000,
      value: roundCurrency(point.value),
    }));
  }, [series, isMobile]);

  return (
    <div className="grid gap-3 sm:gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.82fr)]">
      <article className="flex flex-col overflow-hidden rounded-[1.65rem] bg-[#111317] p-6 shadow-[0_30px_84px_rgba(0,0,0,0.32)] transition-all duration-300 max-sm:rounded-none max-sm:border-b max-sm:border-[#262D3D] max-sm:bg-[#0F1116] max-sm:p-3 max-sm:pb-2 max-sm:shadow-none">
        <div className="flex flex-col gap-4 max-sm:gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#71819b] max-sm:hidden">
              Historial de Holdings
            </p>
            {collapsibleOnMobile ? (
              <div className="hidden max-sm:flex max-sm:items-end max-sm:justify-between max-sm:gap-3">
                <div className="min-w-0">
                  <p className="text-[0.75rem] font-normal leading-[1.4] text-[#B0B6C3]">Saldo total</p>
                  <p className="mt-1 text-[1.375rem] font-semibold leading-[1.2] text-white">{formatCurrency(totalValue)}</p>
                  <p className={`mt-1 text-[0.875rem] font-medium leading-[1.3] ${allTimeProfit >= 0 ? "text-[#16C784]" : "text-[#EA3943]"}`}>
                    {formatSignedCurrency(allTimeProfit)} ({profitPercent >= 0 ? "+" : ""}{profitPercent.toFixed(2)}%)
                  </p>
                </div>

                <div
                  aria-hidden={isChartExpanded}
                  className={`mb-1 w-[5.5rem] shrink-0 overflow-hidden transition-all duration-300 ease-out ${
                    isChartExpanded ? "h-0 opacity-0" : "h-[3rem] opacity-100"
                  }`}
                >
                  <MiniRechartsSparkline color={lineColor} data={rechartsData} />
                </div>
              </div>
            ) : null}
            <div className="mt-3 flex flex-col gap-1 text-[0.9rem] text-[#8fa0b8] max-sm:hidden sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
              <span>
                Ganancia historica:{" "}
                <strong className={allTimeProfit >= 0 ? "text-fintech-positive" : "text-fintech-negative"}>
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

          <div className="flex items-center gap-2 max-sm:hidden">
            <div className="flex items-center">
              {HISTORY_RANGES.map((item) => {
                const active = item.key === range;
                return (
                  <button
                    className={`rounded-[0.9rem] px-3.5 py-2 text-[0.82rem] font-semibold transition ${
                      active
                        ? "bg-[#1a1e24] text-white shadow-[0_14px_28px_rgba(0,0,0,0.18)]"
                        : "text-fintech-muted hover:bg-white/[0.04] hover:text-white"
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
            <div className="ml-1 h-5 w-px bg-white/10" />
            <button
              className={`rounded-[0.9rem] px-3 py-2 text-[0.75rem] font-semibold transition ${
                scaleMode === "log"
                  ? "bg-[#1a1e24] text-white shadow-[0_14px_28px_rgba(0,0,0,0.18)]"
                  : "text-fintech-muted hover:bg-white/[0.04] hover:text-white"
              }`}
              onClick={() => setScaleMode((m) => (m === "linear" ? "log" : "linear"))}
              title={scaleMode === "log" ? "Cambiar a escala lineal" : "Cambiar a escala logarítmica"}
              type="button"
            >
              Log
            </button>
          </div>
        </div>

        <div
          className={`relative mt-6 transition-all duration-300 ease-out max-sm:overflow-hidden ${
            isChartExpanded ? "max-sm:mt-0 max-sm:max-h-[13rem] max-sm:opacity-100" : "max-sm:mt-0 max-sm:max-h-0 max-sm:opacity-0"
          }`}
        >
          <div className="grid grid-rows-[1fr] opacity-100 transition-all duration-500 ease-in-out">
            <div className="overflow-hidden">
              <div className="relative overflow-hidden rounded-[1.35rem] bg-[radial-gradient(circle_at_top_left,_rgba(23,199,132,0.16),_transparent_34%),linear-gradient(180deg,#0d1016_0%,#090b10_100%)] px-4 py-4 shadow-[0_20px_42px_rgba(0,0,0,0.24)] max-sm:rounded-none max-sm:bg-transparent max-sm:px-0 max-sm:py-0 max-sm:shadow-none">
                {isLoading ? (
                  <div className="flex min-h-[16rem] md:min-h-[22rem] items-center justify-center">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#3861fb] border-t-transparent" />
                  </div>
                ) : error ? (
                  <div className="flex min-h-[16rem] md:min-h-[22rem] flex-col items-center justify-center px-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#15181e] shadow-[0_16px_34px_rgba(0,0,0,0.16)]">
                      <ChartLineIcon className="h-8 w-8 text-fintech-negative" />
                    </div>
                    <h3 className="mt-5 text-[1.2rem] font-semibold text-white">No fue posible cargar la serie</h3>
                    <p className="mt-2 max-w-[34rem] text-[0.9rem] leading-7 text-fintech-muted">
                      {error instanceof Error ? error.message : "Ocurrio un error al obtener el historial de holdings."}
                    </p>
                  </div>
                ) : series.length === 0 ? (
                  <div className="flex min-h-[16rem] md:min-h-[22rem] flex-col items-center justify-center px-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#15181e] shadow-[0_16px_34px_rgba(0,0,0,0.16)]">
                      <ChartLineIcon className="h-8 w-8 text-fintech-muted" />
                    </div>
                    <h3 className="mt-5 text-[1.2rem] font-semibold text-white">Aun no hay historial suficiente</h3>
                    <p className="mt-2 max-w-[34rem] text-[0.9rem] leading-7 text-fintech-muted">
                      Registra transacciones para construir la evolucion real del valor de tu portafolio.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-4">
                    <div className="flex items-center gap-2 text-[0.8rem] text-[#8ea0b9] max-sm:hidden">
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
                      {isMobile ? (
                        <div className="h-[16rem] w-full overflow-hidden max-sm:h-[10rem]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={rechartsData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={lineColor} stopOpacity={0.15} />
                                  <stop offset="95%" stopColor={lineColor} stopOpacity={0.02} />
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="time" domain={["dataMin", "dataMax"]} hide type="number" />
                              <YAxis domain={["auto", "auto"]} hide />
                              <RechartsTooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                      <div className="rounded-[0.75rem] bg-[#151922]/95 px-3 py-2 text-[0.75rem] shadow-none">
                                        <p className="text-[0.6875rem] font-normal leading-[1.4] text-[#7D8596]">
                                          {formatTooltipDate(d.time / 1000)}
                                        </p>
                                        <p className="mt-1 text-[0.75rem] font-semibold leading-[1.25] text-white">
                                          Total Value: {formatCurrency(d.value)}
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Area
                                dataKey="value"
                                fill="url(#colorValue)"
                                fillOpacity={1}
                                stroke={lineColor}
                                strokeWidth={2}
                                type="monotone"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <>
                          {tooltip.visible && tooltip.point ? (
                            <div
                              className="pointer-events-none absolute z-10 min-w-[196px] rounded-[1rem] bg-[#13161b]/95 px-4 py-3 shadow-[0_18px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl"
                              style={{ left: tooltip.left, top: tooltip.top }}
                            >
                              <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-fintech-muted">
                                {formatTooltipDate(tooltip.point.time)}
                              </p>
                              <p className="mt-2 text-[0.98rem] font-semibold text-white">
                                Total Value: {formatCurrency(tooltip.value)}
                              </p>
                            </div>
                          ) : null}

                          <div className="h-[16rem] md:h-[22rem] w-full" ref={chartContainerRef} />
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between px-2 sm:hidden">
                {HISTORY_RANGES.map((item) => {
                  const active = item.key === range;
                  return (
                    <button
                      className={`rounded-lg px-3 py-1.5 text-[0.75rem] font-medium leading-[1.35] transition ${
                        active
                          ? "bg-[#262D3D] text-white"
                          : "text-[#7D8596] hover:text-white"
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
          </div>
        </div>

        <div className="mt-3 flex justify-center sm:hidden">
          <button
            aria-expanded={isChartExpanded}
            aria-label={isChartExpanded ? "Reducir grafica" : "Expandir grafica"}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-[#222936] bg-[#14181f] text-[#d3dbe8] shadow-[0_18px_34px_rgba(0,0,0,0.32)] transition hover:bg-[#1a2029] hover:text-white"
            onClick={toggleChart}
            type="button"
          >
            <ChevronDown
              className={`h-7 w-7 transition-transform duration-300 ease-in-out ${
                isChartExpanded ? "rotate-180" : "rotate-0"
              }`}
            />
          </button>
        </div>
      </article>

      <div className="grid gap-4 max-sm:hidden">
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
              <span className="ml-1 text-[1rem] text-fintech-muted">/ {profitBreakdown.total}</span>
            </p>
            <span className="mb-1 rounded-full bg-[#0f2f24] px-2.5 py-1 text-[0.72rem] font-semibold text-[#20d48d]">
              {profitBreakdown.total > 0 ? `${Math.round((profitBreakdown.profitable / profitBreakdown.total) * 100)}%` : "0%"}
            </span>
          </div>
          <p className="mt-2 text-[0.82rem] leading-6 text-fintech-muted">
            {profitBreakdown.losing} {profitBreakdown.losing === 1 ? "activo en perdida" : "activos en perdida"}
            {profitBreakdown.flat > 0 ? ` · ${profitBreakdown.flat} sin cambio` : ""}.
          </p>
        </article>
      </div>
    </div>
  );
}

function buildTimePointMap(points: PortfolioHistoryPoint[]) {
  const lookup = new Map<number, PortfolioHistoryPoint>();
  points.forEach((point) => lookup.set(point.time, point));
  return lookup;
}

function getNearestPoint(points: PortfolioHistoryPoint[], time: number) {
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
    tone === "emerald" ? "text-fintech-positive" : tone === "rose" ? "text-fintech-negative" : "text-white";

  return (
    <article className="rounded-[1.3rem] bg-[#111317] p-5 shadow-[0_30px_84px_rgba(0,0,0,0.24)]">
      <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#71819b]">{label}</p>
      <p className={`mt-3 text-[1.35rem] font-semibold tracking-[-0.04em] ${valueClass}`}>{value}</p>
      <p className="mt-2 text-[0.82rem] text-fintech-muted">{subvalue}</p>
    </article>
  );
}

function MiniRechartsSparkline({
  color,
  data,
}: {
  color: string;
  data: Array<{ time: number; value: number }>;
}) {
  if (!data.length) {
    return <div className="h-full w-full" />;
  }

  return (
    <ResponsiveContainer height="100%" width="100%">
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id="miniPortfolioSparklineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="time" hide />
        <YAxis domain={["auto", "auto"]} hide />
        <Area
          dataKey="value"
          fill="url(#miniPortfolioSparklineFill)"
          fillOpacity={1}
          isAnimationActive={false}
          stroke={color}
          strokeLinecap="round"
          strokeWidth={2}
          type="monotone"
        />
      </AreaChart>
    </ResponsiveContainer>
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
