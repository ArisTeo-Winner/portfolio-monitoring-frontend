"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { ChartRange, PortfolioTotalHistoryResponse } from "@/types/portfolio-chart";

type PortfolioChartState = {
  response: PortfolioTotalHistoryResponse | null;
  loading: boolean;
  error: string | null;
};

const INITIAL_STATE: PortfolioChartState = {
  response: null,
  loading: true,
  error: null,
};

export function usePortfolioChart(range: ChartRange): PortfolioChartState {
  const [state, setState] = useState<PortfolioChartState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ response: null, loading: true, error: null });

    apiRequest<PortfolioTotalHistoryResponse>(
      `${endpoints.portfolio.history}?range=${range}`,
      { auth: true, signal: controller.signal },
    )
      .then((response) => {
        if (controller.signal.aborted) return;
        setState({ response, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "Failed to load portfolio history";
        setState({ response: null, loading: false, error: message });
      });

    return () => {
      controller.abort();
    };
  }, [range]);

  return state;
}
