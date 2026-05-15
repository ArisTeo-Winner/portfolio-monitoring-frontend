"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  ChartRange,
  PortfolioAssetHistoryResponse,
  PortfolioMarkersResponse,
} from "@/types/portfolio-chart";

type AssetChartState = {
  history: PortfolioAssetHistoryResponse | null;
  markers: PortfolioMarkersResponse | null;
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

    Promise.all([
      apiRequest<PortfolioAssetHistoryResponse>(
        `${endpoints.portfolio.assetHistory(symbol)}?range=${range}`,
        opts,
      ),
      apiRequest<PortfolioMarkersResponse>(
        `${endpoints.portfolio.assetMarkers(symbol)}?range=${range}`,
        opts,
      ),
    ])
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
