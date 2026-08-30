// Strict TypeScript contracts aligned with backend historical engine contract.
// DO NOT extend with frontend-inferred fields.

export type ChartRange = "24h" | "7d" | "30d" | "90d" | "180d" | "1y" | "ALL";

export type ChartResolution = "1m" | "5m" | "15m" | "1h" | "4h" | "8h" | "1d" | "1w";

export type TimeValuePoint = {
  readonly time: number;
  readonly value: number;
};

export type PortfolioTotalHistoryResponse = {
  readonly seriesType: "portfolio_total";
  readonly currency: "USD";
  readonly range: ChartRange;
  readonly resolution: ChartResolution;
  readonly from: number;
  readonly to: number;
  readonly points: readonly TimeValuePoint[];
};

// Backend returns plain arrays for asset-level endpoints
export type AssetHistoryPoint = {
  readonly time: number;
  readonly value: number;
};

export type AssetMarkerPoint = {
  readonly time: number;
  readonly position: "aboveBar" | "belowBar" | "inBar";
  readonly color: string;
  readonly shape: "circle" | "square" | "arrowUp" | "arrowDown";
  readonly text: string;
};

// Legacy types kept for portfolio-total history (wrapped format)
export type PortfolioAssetHistoryResponse = AssetHistoryPoint[];
export type PortfolioMarkersResponse = AssetMarkerPoint[];

export type BackendMarker = {
  readonly time: number;
  readonly type: "BUY" | "SELL";
  readonly price?: number;
  readonly quantity?: number;
  readonly total?: number;
  readonly label?: string;
};
