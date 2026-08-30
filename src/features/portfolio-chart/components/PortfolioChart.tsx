"use client";

import { AreaSeries, ColorType, CrosshairMode, createChart } from "lightweight-charts";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";
import { tokens } from "@/lib/design-tokens";
import type { PortfolioDataPoint } from "../types";

const GREEN = tokens.positive;
const RED = tokens.negative;

type Props = {
  data: PortfolioDataPoint[];
  loading?: boolean;
};

export function PortfolioChart({ data, loading = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  const isPositive = useMemo(() => {
    if (data.length < 2) return true;
    return data[data.length - 1].value >= data[0].value;
  }, [data]);

  const lineColor = isPositive ? GREEN : RED;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: tokens.muted,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: tokens.grid },
        horzLines: { color: tokens.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#3d4e6b", labelBackgroundColor: "#1a2235" },
        horzLine: { color: "#3d4e6b", labelBackgroundColor: "#1a2235" },
      },
      rightPriceScale: {
        borderColor: "#1e2535",
        scaleMargins: { top: 0.08, bottom: 0.04 },
      },
      timeScale: {
        borderColor: "#1e2535",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;

    const series = chart.addSeries(AreaSeries, {
      lineColor: GREEN,
      topColor: `${GREEN}30`,
      bottomColor: `${GREEN}00`,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    seriesRef.current = series;

    const ro = new ResizeObserver(([entry]) => {
      if (entry) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });

    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    seriesRef.current?.applyOptions({
      lineColor,
      topColor: `${lineColor}30`,
      bottomColor: `${lineColor}00`,
    });
  }, [lineColor]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series || data.length === 0) return;

    series.setData(
      data.map((point) => ({
        time: Math.floor(point.timestamp / 1000) as UTCTimestamp,
        value: point.value,
      })),
    );

    chartRef.current?.timeScale().fitContent();
  }, [data]);

  if (loading) {
    return (
      <div className="h-[220px] animate-pulse rounded-xl bg-fintech-input md:h-[260px] lg:h-[320px]" />
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl bg-fintech-deep md:h-[260px] lg:h-[320px]">
        <p className="text-[0.82rem] text-fintech-muted">Sin datos historicos disponibles.</p>
      </div>
    );
  }

  return <div ref={containerRef} className="h-[220px] w-full md:h-[260px] lg:h-[320px]" />;
}
