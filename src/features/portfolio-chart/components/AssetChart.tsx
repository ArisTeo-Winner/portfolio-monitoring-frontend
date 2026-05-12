"use client";

import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  createChart,
  createSeriesMarkers,
} from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  SeriesMarkerBar,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";
import type { AssetMarker, HistoryPoint } from "../types";

const LINE_COLOR = "#16C784";
const TOP_COLOR = "rgba(22,199,132,0.3)";
const BOTTOM_COLOR = "rgba(22,199,132,0.05)";
const BG_COLOR = "#0B0E11";
const TEXT_COLOR = "#EAECEF";
const GRID_COLOR = "rgba(255,255,255,0.05)";

export function AssetChart({ data, markers }: { data: HistoryPoint[]; markers: AssetMarker[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: BG_COLOR },
        textColor: TEXT_COLOR,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: GRID_COLOR },
        horzLines: { color: GRID_COLOR },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      leftPriceScale: { visible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 2,
      },
    });

    chartRef.current = chart;

    const series = chart.addSeries(AreaSeries, {
      lineColor: LINE_COLOR,
      topColor: TOP_COLOR,
      bottomColor: BOTTOM_COLOR,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderWidth: 2,
      crosshairMarkerBorderColor: LINE_COLOR,
    });

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

  const normalizedData = useMemo<Array<{ time: UTCTimestamp; value: number }>>(
    () =>
      data
        .filter((p) => p.time > 0)
        .sort((a, b) => a.time - b.time)
        .map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
    [data],
  );

  const normalizedMarkers = useMemo<SeriesMarkerBar<UTCTimestamp>[]>(
    () =>
      markers
        .filter((m) => m.time > 0)
        .sort((a, b) => a.time - b.time)
        .map((m) => ({
          time: m.time as UTCTimestamp,
          position: m.position,
          color: m.color,
          shape: m.shape,
          text: m.text,
        })),
    [markers],
  );

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (normalizedData.length === 0) {
      series.setData([]);
      return;
    }
    series.setData(normalizedData);
    chartRef.current?.timeScale().fitContent();
  }, [normalizedData]);

  useEffect(() => {
    const plugin = markersPluginRef.current;
    if (!plugin) return;
    plugin.setMarkers(normalizedMarkers);
  }, [normalizedMarkers]);

  return (
    <div
      className="h-[220px] w-full sm:h-[240px] md:h-[300px] lg:h-[360px] xl:h-[420px] 2xl:h-[480px]"
      ref={containerRef}
    />
  );
}
