"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getAssetHistory } from "../api/getAssetHistory";
import { getAssetMarkers } from "../api/getAssetMarkers";
import type { AssetChartRange, AssetMarker, HistoryPoint } from "../types";

export function useAssetChartData(symbol: string, range: AssetChartRange) {
  const historyQuery = useQuery({
    queryKey: ["asset-chart-history", symbol, range],
    queryFn: () => getAssetHistory(symbol, range),
    enabled: Boolean(symbol),
  });

  const markersQuery = useQuery({
    queryKey: ["asset-chart-markers", symbol, range],
    queryFn: () => getAssetMarkers(symbol, range),
    enabled: Boolean(symbol),
  });

  const data = useMemo<HistoryPoint[]>(
    () => historyQuery.data ?? [],
    [historyQuery.data],
  );

  const markers = useMemo<AssetMarker[]>(
    () => markersQuery.data ?? [],
    [markersQuery.data],
  );

  return {
    data,
    markers,
    isLoading: historyQuery.isLoading || markersQuery.isLoading,
    isError: historyQuery.isError || markersQuery.isError,
  };
}
