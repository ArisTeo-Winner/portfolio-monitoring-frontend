import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { normalizeAssetOption, type RawAssetOption } from "@/features/assets/lib/normalize-asset-option";
import type { AssetOption } from "@/features/assets/types/asset.types";

// Full list per type (not just the top N like /popular) — used by the
// "Explorar activos" browser so users can see every tradeable asset in a
// given category, including INDEX entries that are query-only.
export async function getAssetsByType(assetType?: string, limit = 50): Promise<AssetOption[]> {
  const params = new URLSearchParams();
  if (assetType) params.set("type", assetType);
  params.set("limit", String(limit));

  const response = await apiRequest<RawAssetOption[]>(
    `${endpoints.assets.byType}?${params.toString()}`,
    { auth: true },
  );

  return response.map(normalizeAssetOption);
}
