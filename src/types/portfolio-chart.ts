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

export type PortfolioAssetHistoryResponse = {
  readonly seriesType: "asset_holdings";
  readonly currency: "USD";
  readonly range: ChartRange;
  readonly resolution: ChartResolution;
  readonly from: number;
  readonly to: number;
  readonly points: readonly TimeValuePoint[];
};

export type BackendMarker = {
  readonly time: number;
  readonly type: "BUY" | "SELL";
  readonly price?: number;
  readonly quantity?: number;
  readonly total?: number;
  readonly label?: string;
};

export type PortfolioMarkersResponse = {
  readonly seriesType: "asset_markers";
  readonly asset: {
    readonly symbol: string;
    readonly assetType: string;
  };
  readonly markers: readonly BackendMarker[];
};
