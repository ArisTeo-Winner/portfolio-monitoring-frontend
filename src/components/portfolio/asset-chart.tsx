"use client";

import { AreaSeries, createChart, createSeriesMarkers, PriceScaleMode } from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  MouseEventParams,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { areaSeriesOptions, baseChartOptions, CHART_THEME } from "@/lib/chart/lightweight-config";
import { useAssetChart } from "@/features/portfolio/hooks/use-asset-chart";
import type { ChartRange } from "@/types/portfolio-chart";
import { formatCurrency } from "@/lib/utils/format";

const CHART_HEIGHT = "h-[240px] md:h-[300px] lg:h-[360px]";

type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  time: number;
  value: number;
};

const INITIAL_TOOLTIP: TooltipState = { visible: false, x: 0, y: 0, time: 0, value: 0 };

type DataPoint = { time: number; value: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatTooltipDate(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  symbol: string;
  range: ChartRange;
  scaleMode?: "linear" | "log";
};

export function AssetChart({ symbol, range, scaleMode = "linear" }: Props) {
  const { history, markers, loading, error } = useAssetChart(symbol, range);

  const containerRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  // Always-fresh snapshot of current data for the crosshair handler
  const historyRef = useRef<DataPoint[]>([]);

  const [tooltip, setTooltip] = useState<TooltipState>(INITIAL_TOOLTIP);

  // Keep historyRef in sync with latest data
  useEffect(() => {
    historyRef.current = (history as DataPoint[] | null) ?? [];
  }, [history]);

  // Initialize chart once on mount — never recreate
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, baseChartOptions);
    chartRef.current = chart;

    const series = chart.addSeries(AreaSeries, areaSeriesOptions);
    seriesRef.current = series;
    markersPluginRef.current = createSeriesMarkers(series);

    // Custom floating tooltip
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
      markersPluginRef.current?.detach();
      markersPluginRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Apply scale mode without recreating the chart
  useEffect(() => {
    chartRef.current?.priceScale("right").applyOptions({
      mode: scaleMode === "log" ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    });
  }, [scaleMode]);

  // Update series data when history changes — backend guarantees ascending order
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    if (!history?.length) {
      series.setData([]);
      return;
    }

    series.setData(
      (history as DataPoint[]).map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.value,
      })),
    );

    chart.timeScale().fitContent();
  }, [history]);

  // Update markers when markers response changes
  useEffect(() => {
    const plugin = markersPluginRef.current;
    if (!plugin) return;

    if (!markers?.length) {
      plugin.setMarkers([]);
      return;
    }

    plugin.setMarkers(
      markers.map((m) => ({ ...m, time: m.time as UTCTimestamp })),
    );
  }, [markers]);

  const showLoading = loading;
  const showError = !loading && !!error;
  const showEmpty = !loading && !error && !history?.length;
  const showChart = !loading && !error && !!history?.length;

  return (
    <>
      {showLoading ? (
        <div
          className={`${CHART_HEIGHT} w-full animate-pulse rounded-xl`}
          style={{
            backgroundColor:
              CHART_THEME.background === "transparent"
                ? "rgba(255,255,255,0.03)"
                : CHART_THEME.background,
          }}
        />
      ) : null}

      {showError ? (
        <div className={`${CHART_HEIGHT} flex items-center justify-center`}>
          <p className="text-[0.82rem] text-fintech-muted">
            No fue posible cargar el historial de precio.
          </p>
        </div>
      ) : null}

      {showEmpty ? (
        <div className={`${CHART_HEIGHT} flex items-center justify-center`}>
          <p className="text-[0.82rem] text-fintech-muted">
            Sin datos históricos disponibles.
          </p>
        </div>
      ) : null}

      {/* Shell keeps relative positioning for the tooltip overlay */}
      <div
        className={`relative ${showChart ? "" : "hidden"}`}
        onMouseLeave={() =>
          setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev))
        }
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
              {formatCurrency(tooltip.value)}
            </p>
          </div>
        ) : null}

        {/* Always mounted so the init useEffect can attach the chart on first render */}
        <div ref={containerRef} className={CHART_HEIGHT} />
      </div>
    </>
  );
}
