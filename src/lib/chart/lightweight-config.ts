import { ColorType, CrosshairMode, LineType, PriceScaleMode } from "lightweight-charts";
import type { AreaStyleOptions, ChartOptions, DeepPartial, SeriesOptionsCommon } from "lightweight-charts";
import { tokens } from "@/lib/design-tokens";

export const CHART_THEME = {
  line: tokens.positive,
  lineNegative: tokens.negative,
  topGradient: `${tokens.positive}28`,
  bottomGradient: `${tokens.positive}00`,
  background: "transparent" as const,
  text: "#c4cede",
  grid: "rgba(255,255,255,0.03)",
  crosshair: "#3d4e6b",
  crosshairLabel: "#1a2235",
  border: "#1e2535",
} as const;

export const baseChartOptions: DeepPartial<ChartOptions> = {
  autoSize: true,
  layout: {
    background: { type: ColorType.Solid, color: CHART_THEME.background },
    textColor: CHART_THEME.text,
    fontSize: 11,
    attributionLogo: false,
  },
  grid: {
    vertLines: { visible: false },
    horzLines: { color: CHART_THEME.grid, visible: true },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: {
      color: CHART_THEME.crosshair,
      labelBackgroundColor: CHART_THEME.crosshairLabel,
      labelVisible: true,
    },
    horzLine: {
      color: CHART_THEME.crosshair,
      labelBackgroundColor: CHART_THEME.crosshairLabel,
      labelVisible: true,
    },
  },
  rightPriceScale: {
    borderVisible: false,
    scaleMargins: { top: 0.08, bottom: 0.04 },
    mode: PriceScaleMode.Normal,
    visible: true,
  },
  leftPriceScale: { visible: false },
  timeScale: {
    borderVisible: false,
    timeVisible: true,
    secondsVisible: false,
    rightOffset: 3,
    shiftVisibleRangeOnNewBar: false,
  },
  handleScroll: true,
  handleScale: true,
  localization: {
    priceFormatter: (price: number) => {
      if (!Number.isFinite(price)) return "--";
      if (price >= 1_000_000) {
        return `$${(price / 1_000_000).toFixed(2)}M`;
      }
      if (price >= 1_000) {
        return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      if (price >= 1) {
        return `$${price.toFixed(2)}`;
      }
      return `$${price.toFixed(4)}`;
    },
  },
};

export const areaSeriesOptions: DeepPartial<AreaStyleOptions & SeriesOptionsCommon> = {
  lineColor: CHART_THEME.line,
  topColor: CHART_THEME.topGradient,
  bottomColor: CHART_THEME.bottomGradient,
  lineWidth: 2,
  lineType: LineType.Curved,
  priceLineVisible: false,
  lastValueVisible: false,
  crosshairMarkerVisible: true,
  crosshairMarkerRadius: 4,
  crosshairMarkerBorderWidth: 2,
  crosshairMarkerBorderColor: CHART_THEME.line,
  crosshairMarkerBackgroundColor: CHART_THEME.line,
  priceFormat: {
    type: "price",
    precision: 2,
    minMove: 0.01,
  },
};
