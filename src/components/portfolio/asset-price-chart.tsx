"use client";

import { AreaSeries, createChart } from "lightweight-charts";
import type { IChartApi, ISeriesApi, MouseEventParams, Time, UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { areaSeriesOptions, baseChartOptions, CHART_THEME } from "@/lib/chart/lightweight-config";
import { formatCurrencyByCode, type CurrencyCode } from "@/lib/utils/currency";
import type { PricePoint } from "@/features/marketdata/types/price-history.types";

const CHART_HEIGHT = "h-[240px] md:h-[300px] lg:h-[360px]";

type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  time: number;
  value: number;
};

const INITIAL_TOOLTIP: TooltipState = { visible: false, x: 0, y: 0, time: 0, value: 0 };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatTooltipDate(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Props = {
  points: PricePoint[] | null;
  currency: CurrencyCode;
  loading: boolean;
  error: string | null;
};

export function AssetPriceChart({ points, currency, loading, error }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const [tooltip, setTooltip] = useState<TooltipState>(INITIAL_TOOLTIP);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, baseChartOptions);
    chartRef.current = chart;

    const series = chart.addSeries(AreaSeries, areaSeriesOptions);
    seriesRef.current = series;

    const crosshairHandler = (param: MouseEventParams<Time>) => {
      const shell = shellRef.current;
      if (!param.point || typeof param.time !== "number" || !shell) {
        setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }
      const datum = param.seriesData.get(series) as { value?: number } | undefined;
      const value = datum?.value;
      if (value === undefined) {
        setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }
      const x = clamp(param.point.x + 18, 16, shell.clientWidth - 210);
      const y = clamp(param.point.y + 18, 16, shell.clientHeight - 96);
      setTooltip({ visible: true, x, y, time: param.time, value });
    };

    chart.subscribeCrosshairMove(crosshairHandler);

    const ro = new ResizeObserver(() => {
      chart.timeScale().fitContent();
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.unsubscribeCrosshairMove(crosshairHandler);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    if (!points?.length) {
      series.setData([]);
      return;
    }

    series.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })));
    chart.timeScale().fitContent();
  }, [points]);

  const showLoading = loading;
  const showError = !loading && !!error;
  const showEmpty = !loading && !error && !points?.length;
  const showChart = !loading && !error && !!points?.length;

  return (
    <>
      {showLoading ? (
        <div
          className={`${CHART_HEIGHT} w-full animate-pulse rounded-xl`}
          style={{
            backgroundColor:
              CHART_THEME.background === "transparent" ? "rgba(255,255,255,0.03)" : CHART_THEME.background,
          }}
        />
      ) : null}

      {showError ? (
        <div className={`${CHART_HEIGHT} flex items-center justify-center`}>
          <p className="text-[0.82rem] text-fintech-muted">No fue posible cargar el precio de mercado.</p>
        </div>
      ) : null}

      {showEmpty ? (
        <div className={`${CHART_HEIGHT} flex items-center justify-center`}>
          <p className="text-[0.82rem] text-fintech-muted">Sin datos de precio disponibles.</p>
        </div>
      ) : null}

      <div
        className={`relative ${showChart ? "" : "hidden"}`}
        onMouseLeave={() => setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev))}
        ref={shellRef}
      >
        {tooltip.visible ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[180px] rounded-[0.9rem] bg-[#13161b]/95 px-4 py-3 shadow-[0_18px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-fintech-muted">
              {formatTooltipDate(tooltip.time)}
            </p>
            <p className="mt-2 text-[0.95rem] font-semibold text-white">
              {formatCurrencyByCode(tooltip.value, currency)}
            </p>
          </div>
        ) : null}

        <div ref={containerRef} className={CHART_HEIGHT} />
      </div>
    </>
  );
}
