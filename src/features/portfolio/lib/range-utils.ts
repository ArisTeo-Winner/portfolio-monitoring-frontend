export type HistoryRange = "24h" | "7d" | "30d" | "90d" | "ALL";

const RANGE_SECONDS: Record<Exclude<HistoryRange, "ALL">, number> = {
  "24h": 24 * 60 * 60,
  "7d": 7 * 24 * 60 * 60,
  "30d": 30 * 24 * 60 * 60,
  "90d": 90 * 24 * 60 * 60,
};

export function rangeToSeconds(range: HistoryRange): number | null {
  if (range === "ALL") return null;
  return RANGE_SECONDS[range];
}

export function rangeCutoffSeconds(range: HistoryRange, nowSeconds?: number): number | null {
  const duration = rangeToSeconds(range);
  if (duration === null) return null;
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  return now - duration;
}

export function filterSeriesByRange<T extends { time: number }>(
  series: T[],
  range: HistoryRange,
  nowSeconds?: number,
): T[] {
  const cutoff = rangeCutoffSeconds(range, nowSeconds);
  if (cutoff === null) return series;
  return series.filter((point) => point.time >= cutoff);
}
