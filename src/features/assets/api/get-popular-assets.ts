import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { normalizeAssetOption, type RawAssetOption } from "@/features/assets/lib/normalize-asset-option";
import type { AssetOption } from "@/features/assets/types/asset.types";

export type PopularAssets = {
  stocks: AssetOption[];
  etfs: AssetOption[];
  cryptos: AssetOption[];
  governmentBonds: AssetOption[];
};

type RawPopularAssetsResponse = {
  stocks?: RawAssetOption[];
  etfs?: RawAssetOption[];
  cryptos?: RawAssetOption[];
  governmentBonds?: RawAssetOption[];
};

export async function getPopularAssets(): Promise<PopularAssets> {
  const response = await apiRequest<RawPopularAssetsResponse>(endpoints.assets.popular, {
    auth: true,
  });

  return {
    stocks: (response.stocks ?? []).map(normalizeAssetOption),
    etfs: (response.etfs ?? []).map(normalizeAssetOption),
    cryptos: (response.cryptos ?? []).map(normalizeAssetOption),
    governmentBonds: (response.governmentBonds ?? []).map(normalizeAssetOption),
  };
}
