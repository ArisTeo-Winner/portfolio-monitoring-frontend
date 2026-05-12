import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { AssetChartRange, HistoryPoint } from "../types";

export async function getAssetHistory(symbol: string, range: AssetChartRange): Promise<HistoryPoint[]> {
  const path = `${endpoints.portfolio.assetHistory(symbol)}?range=${range}`;
  return apiRequest<HistoryPoint[]>(path, { auth: true });
}
