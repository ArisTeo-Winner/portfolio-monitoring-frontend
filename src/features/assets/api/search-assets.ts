import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { normalizeAssetOption, type RawAssetOption } from "@/features/assets/lib/normalize-asset-option";
import type { AssetOption, AssetSearchResponse } from "@/features/assets/types/asset.types";

type RawAssetSearchResponse = AssetSearchResponse | RawAssetOption[];

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

  // Intentionally NOT filtering by supportedForTransactions here: unsupported
  // assets (e.g. INDEX) must still reach the UI so the selector can render
  // them disabled with an explanatory tooltip instead of hiding them.
  return items.map(normalizeAssetOption);
}
