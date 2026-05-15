import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { normalizeAssetType } from "@/lib/utils/asset";
import type { AssetOption, AssetSearchResponse } from "@/features/assets/types/asset.types";

type RawAssetSearchResponse = AssetSearchResponse | RawAssetOption[];

type RawAssetOption = Partial<AssetOption> & {
  id?: string;
  asset_id?: string;
  asset_symbol?: string;
  asset_name?: string;
  asset_type?: string;
  logo_url?: string | null;
  supported_for_transactions?: boolean;
};

export async function searchAssets(query: string, limit = 8): Promise<AssetOption[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const response = await apiRequest<RawAssetSearchResponse>(
    `${endpoints.assets.search}?q=${encodeURIComponent(normalizedQuery)}&limit=${limit}`,
    { auth: true },
  );

  const items = Array.isArray(response) ? response : response.items ?? [];

  return items.map(normalizeAssetOption).filter((item) => item.supportedForTransactions);
}

function normalizeAssetOption(item: RawAssetOption): AssetOption {
  const symbol = (item.symbol ?? item.asset_symbol ?? "").trim().toUpperCase();
  const name = (item.name ?? item.asset_name ?? symbol).trim();
  const assetType = normalizeAssetType(item.assetType ?? item.asset_type ?? "CRYPTO");

  return {
    assetId: (item.assetId ?? item.asset_id ?? item.id ?? symbol).trim(),
    symbol,
    name,
    assetType,
    logoUrl: item.logoUrl ?? item.logo_url ?? null,
    supportedForTransactions: item.supportedForTransactions ?? item.supported_for_transactions ?? true,
    suggestedPrice: item.suggestedPrice,
  };
}

