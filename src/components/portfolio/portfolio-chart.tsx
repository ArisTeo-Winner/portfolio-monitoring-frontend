"use client";

import { AreaSeries, createChart } from "lightweight-charts";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";
import { areaSeriesOptions, baseChartOptions, CHART_THEME } from "@/lib/chart/lightweight-config";
import { usePortfolioChart } from "@/features/portfolio/hooks/use-portfolio-chart";
import type { ChartRange } from "@/types/portfolio-chart";
import { tokens } from "@/lib/design-tokens";

const CHART_HEIGHT = "h-[240px] md:h-[300px] lg:h-[360px]";

type Props = {
  range: ChartRange;
};

export function PortfolioChart({ range }: Props) {
  const { response, loading, error } = usePortfolioChart(range);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  // Initialize chart once on mount — never recreate
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, baseChartOptions);
    chartRef.current = chart;

    const series = chart.addSeries(AreaSeries, areaSeriesOptions);
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      chart.timeScale().fitContent();
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Update series when backend response changes — no sorting (backend guarantees order)
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    if (!response || response.points.length === 0) {
      series.setData([]);
      return;
    }

    const first = response.points[0].value;
    const last = response.points[response.points.length - 1].value;
    const isPositive = last >= first;
    const lineColor = isPositive ? tokens.positive : tokens.negative;

    series.applyOptions({
      lineColor,
      topColor: `${lineColor}28`,
      bottomColor: `${lineColor}00`,
      crosshairMarkerBorderColor: lineColor,
      crosshairMarkerBackgroundColor: lineColor,
    });

    series.setData(
      response.points.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.value,
      })),
    );

    chart.timeScale().fitContent();
  }, [response]);

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
          No fue posible cargar el historial.
        </p>
      </div>
    );
  }

  if (!response || response.points.length === 0) {
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
