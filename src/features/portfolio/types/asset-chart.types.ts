export type HistoryPoint = {
  time: number;
  value: number;
};

export type AssetMarker = {
  time: number;
  position: "aboveBar" | "belowBar" | "inBar";
  color: string;
  shape: "circle" | "square" | "arrowUp" | "arrowDown";
  text: string;
};

export type AssetChartRange = "24h" | "7d" | "30d" | "90d" | "all";
