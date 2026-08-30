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
  // Presentes cuando algún activo no se pudo cotizar en ningún proveedor: la serie es parcial.
  partial?: boolean;
  unavailableSymbols?: string[];
};

export type PortfolioHistoryResponse = {
  meta: PortfolioHistoryMeta;
  series: PortfolioHistoryPoint[];
};
