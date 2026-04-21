export type HoldingsPerformancePoint = {
  time: number;
  value: number;
};

export type HoldingsPerformanceResponse = {
  series: HoldingsPerformancePoint[];
  isProfit: boolean;
  allTimeProfit: number;
  costBasis: number;
};
