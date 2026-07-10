"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { getBmvHistorical } from "@/features/marketdata/api/get-bmv-historical";
import { getUsdMxnRate } from "@/features/marketdata/api/get-usd-mxn-rate";
import { getAssetCurrency, type CurrencyCode } from "@/lib/utils/currency";
import type { AssetPriceRange, FxRate, PricePoint } from "@/features/marketdata/types/price-history.types";
import type { AssetHistoryPoint } from "@/types/portfolio-chart";

type AssetPriceChartState = {
  points: PricePoint[] | null;
  currency: CurrencyCode;
  fxRate: FxRate | null;
  loading: boolean;
  error: string | null;
};

// Maps the market-price range labels (1M/6M/1A/5A) onto the ranges the
// internal portfolio asset-history endpoint already understands — reused for
// USD assets since no dedicated raw USD historical endpoint exists yet.
const USD_RANGE_MAP: Record<AssetPriceRange, "30d" | "180d" | "1y" | "ALL"> = {
  "1M": "30d",
  "6M": "180d",
  "1A": "1y",
  "5A": "ALL",
};

const BMV_RANGE_DAYS: Record<AssetPriceRange, number> = {
  "1M": 30,
  "6M": 182,
  "1A": 365,
  "5A": 365 * 5,
};

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function useAssetPriceChart(symbol: string, range: AssetPriceRange): AssetPriceChartState {
  const currency = getAssetCurrency(symbol);
  const [state, setState] = useState<AssetPriceChartState>({
    points: null,
    currency,
    fxRate: null,
    loading: true,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!symbol) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ points: null, currency, fxRate: null, loading: true, error: null });

    async function load() {
      try {
        if (currency === "MXN") {
          const to = new Date();
          const from = new Date(to);
          from.setDate(from.getDate() - BMV_RANGE_DAYS[range]);

          const [history, fxRate] = await Promise.all([
            getBmvHistorical(symbol, toIsoDate(from), toIsoDate(to)),
            getUsdMxnRate().catch(() => null),
          ]);

          if (controller.signal.aborted) return;

          const points: PricePoint[] = history.map((point) => ({
            time: Math.floor(new Date(point.date).getTime() / 1000),
            value: point.closePrice,
          }));
          setState({ points, currency, fxRate, loading: false, error: null });
        } else {
          const backendRange = USD_RANGE_MAP[range];
          const history = await apiRequest<AssetHistoryPoint[]>(
            `${endpoints.portfolio.assetHistory(symbol)}?range=${backendRange}`,
            { auth: true, signal: controller.signal },
          );

          if (controller.signal.aborted) return;

          setState({
            points: history.map((point) => ({ time: point.time, value: point.value })),
            currency,
            fxRate: null,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Failed to load asset price chart";
        setState({ points: null, currency, fxRate: null, loading: false, error: message });
      }
    }

    void load();

    return () => {
      controller.abort();
    };
  }, [symbol, range, currency]);

  return state;
}
