"use client";

import { useCallback, useEffect, useState } from "react";
import { getPortfolioHistory } from "../api/get-portfolio-history";
import type { HistoryRange, PortfolioDataPoint } from "../types";

export function usePortfolioHistory(range: HistoryRange) {
  const [data, setData] = useState<PortfolioDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const history = await getPortfolioHistory(range);
      setData(history);
    } catch {
      setError("No fue posible cargar el historial.");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error };
}
