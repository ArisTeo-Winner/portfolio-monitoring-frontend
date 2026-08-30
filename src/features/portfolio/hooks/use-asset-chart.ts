"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  AssetHistoryPoint,
  AssetMarkerPoint,
  ChartRange,
} from "@/types/portfolio-chart";

type AssetChartState = {
  history: AssetHistoryPoint[] | null;
  markers: AssetMarkerPoint[] | null;
  loading: boolean;
  error: string | null;
};

const INITIAL_STATE: AssetChartState = {
  history: null,
  markers: null,
  loading: true,
  error: null,
};

export function useAssetChart(symbol: string, range: ChartRange): AssetChartState {
  const [state, setState] = useState<AssetChartState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!symbol) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ history: null, markers: null, loading: true, error: null });

    const opts = { auth: true, signal: controller.signal };

    // Markers are optional — a failure there must never block the chart.
    const historyReq = apiRequest<AssetHistoryPoint[]>(
      `${endpoints.portfolio.assetHistory(symbol)}?range=${range}`,
      opts,
    );
    const markersReq = apiRequest<AssetMarkerPoint[]>(
      `${endpoints.portfolio.assetMarkers(symbol)}?range=${range}`,
      opts,
    ).catch((): AssetMarkerPoint[] => []);

    Promise.all([historyReq, markersReq])
      .then(([history, markers]) => {
        if (controller.signal.aborted) return;
        setState({ history, markers, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "Failed to load asset chart data";
        setState({ history: null, markers: null, loading: false, error: message });
      });

    return () => {
      controller.abort();
    };
  }, [symbol, range]);

  return state;
}
