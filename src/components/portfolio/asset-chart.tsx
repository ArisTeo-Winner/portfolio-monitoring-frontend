"use client";

import { AreaSeries, createChart, createSeriesMarkers } from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import { areaSeriesOptions, baseChartOptions, CHART_THEME } from "@/lib/chart/lightweight-config";
import { mapMarkersToLightweight } from "@/lib/chart/marker-adapter";
import { useAssetChart } from "@/features/portfolio/hooks/use-asset-chart";
import type { ChartRange } from "@/types/portfolio-chart";

const CHART_HEIGHT = "h-[240px] md:h-[300px] lg:h-[360px]";

type Props = {
  symbol: string;
  range: ChartRange;
};

export function AssetChart({ symbol, range }: Props) {
  const { history, markers, loading, error } = useAssetChart(symbol, range);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  // Initialize chart once on mount — never recreate
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, baseChartOptions);
    chartRef.current = chart;

    const series = chart.addSeries(AreaSeries, areaSeriesOptions);
    seriesRef.current = series;
    markersPluginRef.current = createSeriesMarkers(series);

    const ro = new ResizeObserver(() => {
      chart.timeScale().fitContent();
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      markersPluginRef.current?.detach();
      markersPluginRef.current = null;
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update series data when history changes — no sorting (backend guarantees order)
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    if (!history?.points?.length) {
      series.setData([]);
      return;
    }

    series.setData(
      history.points.map((p) => ({
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

    if (!markers?.markers?.length) {
      plugin.setMarkers([]);
      return;
    }

    plugin.setMarkers(mapMarkersToLightweight(markers.markers));
  }, [markers]);

  if (loading) {
    return (
      <div
        className={`${CHART_HEIGHT} w-full animate-pulse rounded-xl`}
        style={{ backgroundColor: CHART_THEME.background === "transparent" ? "rgba(255,255,255,0.03)" : CHART_THEME.background }}
      />
    );
  }

  if (error) {
    return (
      <div className={`${CHART_HEIGHT} flex items-center justify-center`}>
        <p className="text-[0.82rem] text-fintech-muted">
          No fue posible cargar el historial de precio.
        </p>
      </div>
    );
  }

  if (!history?.points?.length) {
    return (
      <div className={`${CHART_HEIGHT} flex items-center justify-center`}>
        <p className="text-[0.82rem] text-fintech-muted">
          Sin datos históricos disponibles.
        </p>
      </div>
    );
  }

  return <div ref={containerRef} className={`${CHART_HEIGHT} w-full`} />;
}
