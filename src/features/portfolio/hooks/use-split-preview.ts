"use client";

import { useEffect, useState } from "react";
import { getSplitPreview } from "@/features/portfolio/api/get-split-preview";
import type { SplitPreviewResponse } from "@/features/portfolio/types/split-preview.types";

type UseSplitPreviewParams = {
  /** Asset ticker. Null/empty disables the query. */
  symbol: string | null | undefined;
  /** ISO-8601 with offset. Null/empty disables the query. */
  transactionDate: string | null | undefined;
  /** Optional — when present the response carries adjusted amounts, not just detection. */
  quantity?: number;
  pricePerUnit?: number;
  /** Caller gates by asset type / mode / editing. When false the hook is inert. */
  enabled: boolean;
  /** Debounce before firing. Use ~500ms for live typing (modal), 0 for fixed inputs (detail). */
  debounceMs?: number;
};

type UseSplitPreviewResult = {
  data: SplitPreviewResponse | null;
  loading: boolean;
};

// Best-effort, non-blocking split equivalence lookup. Errors are swallowed (data
// stays null) so the preview NEVER blocks the form or the detail view. Changing
// inputs aborts the in-flight request; a stable input set is only queried once.
export function useSplitPreview({
  symbol,
  transactionDate,
  quantity,
  pricePerUnit,
  enabled,
  debounceMs = 500,
}: UseSplitPreviewParams): UseSplitPreviewResult {
  const [data, setData] = useState<SplitPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const active = enabled && Boolean(symbol) && Boolean(transactionDate);
  // Encodes every input that changes the result — the effect re-runs only when
  // this string changes, so identical inputs are not re-queried.
  const key = active ? `${symbol}|${transactionDate}|${quantity ?? ""}|${pricePerUnit ?? ""}` : null;

  useEffect(() => {
    if (!key || !symbol || !transactionDate) {
      setData(null);
      setLoading(false);
      return;
    }

    let alive = true;
    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(() => {
      getSplitPreview({ symbol, transactionDate, quantity, pricePerUnit }, controller.signal)
        .then((result) => {
          if (alive) {
            setData(result);
            setLoading(false);
          }
        })
        .catch(() => {
          // AbortError or a real failure — either way the preview is optional.
          if (alive) {
            setData(null);
            setLoading(false);
          }
        });
    }, debounceMs);

    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timer);
    };
    // `key` encodes symbol/date/quantity/pricePerUnit; they are listed so the
    // request uses current values without widening re-runs beyond `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, debounceMs]);

  return { data, loading };
}
