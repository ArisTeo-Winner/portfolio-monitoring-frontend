export type PortfolioDataPoint = {
  timestamp: number;
  value: number;
};

export type HistoryRange = "24h" | "7d" | "30d" | "90d" | "all";
