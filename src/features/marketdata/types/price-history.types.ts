export type BmvPricePoint = {
  date: string;
  closePrice: number;
  amountTraded: number;
};

export type FxRate = {
  rate: number;
  pctChange: number;
  absChange: number;
};

export type PricePoint = {
  time: number;
  value: number;
};

export type AssetPriceRange = "1M" | "6M" | "1A" | "5A";
