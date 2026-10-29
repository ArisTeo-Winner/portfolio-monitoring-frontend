import { apiRequest } from "@/lib/api/client";
import type { HistoryRange, PortfolioDataPoint } from "../types";

export async function getPortfolioHistory(range: HistoryRange): Promise<PortfolioDataPoint[]> {
  return apiRequest<PortfolioDataPoint[]>(`/api/v1/portfolio/history?range=${range}`, { auth: true });
}
