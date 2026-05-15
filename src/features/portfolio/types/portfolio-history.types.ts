export type PortfolioHistoryPoint = {
  time: number;
  value: number;
};

export type PortfolioHistoryMeta = {
  range: string;
  resolution: string;
  from: number;
  to: number;
  currency: string;
  points: number;
};

export type PortfolioHistoryResponse = {
  meta: PortfolioHistoryMeta;
  series: PortfolioHistoryPoint[];
};
