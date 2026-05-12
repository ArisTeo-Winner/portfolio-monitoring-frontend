import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { AssetChartRange, AssetMarker } from "../types";

export async function getAssetMarkers(symbol: string, range: AssetChartRange): Promise<AssetMarker[]> {
  const path = `${endpoints.portfolio.assetMarkers(symbol)}?range=${range}`;
  return apiRequest<AssetMarker[]>(path, { auth: true });
}
