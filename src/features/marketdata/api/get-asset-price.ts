import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";

type CryptoPriceResponse = {
  symbol: string;
  assetType: string;
  price: {
    amount: number | string;
    currency: string;
  };
  asOf: string;
  provider: string;
};

export async function getAssetPrice(symbol: string, assetType: string): Promise<number> {
  const normalizedType = assetType.trim().toUpperCase();

  if (normalizedType === "CRYPTO") {
    const response = await apiRequest<CryptoPriceResponse>(endpoints.marketdata.cryptoPrice(symbol), { auth: true });
    return Number(response.price.amount);
  }

  if (normalizedType === "STOCK" || normalizedType === "STOCKS" || normalizedType === "ETF") {
    const response = await apiRequest<number | string>(endpoints.marketdata.stockPrice(symbol), { auth: true });
    return Number(response);
  }

  if (normalizedType === "INDEX") {
    throw new Error("Live pricing for indices is not available yet.");
  }

  throw new Error(`Unsupported asset type for live pricing: ${assetType}`);
}
