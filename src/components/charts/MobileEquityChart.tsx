"use client";

import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import type { ECharts, EChartsCoreOption } from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

export interface MobileEquityChartProps {
  data: { time: string; value: number }[];
}

type TooltipParam = {
  axisValueLabel?: string;
  value?: number | string | Array<number | string | null>;
};

const CHART_HEIGHT = 220;
const LINE_COLOR = "#00FFC8";

export function MobileEquityChart({ data }: MobileEquityChartProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<ECharts | null>(null);

  const option = useMemo<EChartsCoreOption>(
    () => ({
      backgroundColor: "transparent",
      animation: true,
      animationDuration: 450,
      animationEasing: "cubicOut",
      grid: {
        top: 10,
        bottom: 25,
        left: 0,
        right: 0,
        containLabel: false,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(20,20,20,0.95)",
        borderWidth: 0,
        padding: [6, 8],
        confine: true,
        textStyle: {
          color: "#fff",
          fontSize: 12,
          fontWeight: 500,
        },
        axisPointer: {
          type: "line",
          lineStyle: {
            color: "rgba(255,255,255,0.12)",
            width: 1,
          },
        },
        formatter: (params: unknown) => {
          const point = (Array.isArray(params) ? params[0] : params) as TooltipParam | undefined;
          const rawValue = Array.isArray(point?.value) ? point?.value[1] : point?.value;
          const value = Number(rawValue);

          if (!point || Number.isNaN(value)) {
            return "";
          }

          return [
            '<div style="line-height:1.35;">',
            `<div style="color:#9ca3af;">${point.axisValueLabel ?? ""}</div>`,
            `<div style="color:#ffffff;">${value.toLocaleString()}</div>`,
            "</div>",
          ].join("");
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.map((point) => point.time),
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: "#888",
          fontSize: 12,
          fontWeight: 500,
          margin: 10,
          hideOverlap: true,
          interval: Math.max(0, Math.ceil(data.length / 4) - 1),
        },
      },
      yAxis: {
        type: "value",
        scale: true,
        splitLine: {
          show: false,
        },
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          show: false,
        },
      },
      series: [
        {
          type: "line",
          data: data.map((point) => point.value),
          smooth: true,
          showSymbol: false,
          symbol: "none",
          lineStyle: {
            color: LINE_COLOR,
            width: 2,
          },
          areaStyle: {
            opacity: 1,
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(0, 255, 200, 0.25)" },
              { offset: 1, color: "rgba(0, 255, 200, 0.02)" },
            ]),
          },
          emphasis: {
            disabled: true,
            focus: "none",
          },
        },
      ],
    }),
    [data],
  );

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    const chart = echarts.init(chartRef.current, "dark", {
      renderer: "canvas",
      devicePixelRatio: window.devicePixelRatio || 2,
    });

    chartInstanceRef.current = chart;

    const resizeChart = () => chart.resize();
    const resizeObserver = new ResizeObserver(resizeChart);

    resizeObserver.observe(chartRef.current);
    window.addEventListener("resize", resizeChart, { passive: true });

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", resizeChart);
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartInstanceRef.current?.setOption(option, {
      notMerge: true,
      lazyUpdate: true,
    });
  }, [option]);

  return (
    <div className="w-full max-w-screen-sm bg-[#141416]">
      <div
        aria-label="Mobile equity chart"
        className="w-full"
        ref={chartRef}
        role="img"
        style={{ height: CHART_HEIGHT }}
      />
    </div>
  );
}

const exampleData = [
  { time: "1d", value: 4413 },
  { time: "04:00", value: 4386 },
  { time: "08:00", value: 4402 },
  { time: "12:00", value: 4368 },
  { time: "16:00", value: 4431 },
  { time: "20:00", value: 4392 },
  { time: "Now", value: 4349 },
];

export function MobileEquityChartExample() {
  return (
    <main className="min-h-screen bg-[#141416] px-4 text-white">
      <section className="mx-auto max-w-screen-sm pt-6">
        <MobileEquityChart data={exampleData} />
      </section>
    </main>
  );
}
