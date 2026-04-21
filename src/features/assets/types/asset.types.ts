export type AssetOption = {
  assetId: string;
  symbol: string;
  name: string;
  assetType: string;
  logoUrl: string | null;
  supportedForTransactions: boolean;
  suggestedPrice?: number;
};

export type AssetSearchResponse = {
  items: AssetOption[];
  total: number;
  query: string;
};
