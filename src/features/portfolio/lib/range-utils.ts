// Fuente única de verdad de los rangos de gráfica del portafolio.
// Tokens canónicos alineados con el backend: 1D, 1S, 1M, 3M, 6M, 1Y, ALL.
// Los rangos por mes/año se calculan por CALENDARIO (no días fijos), igual que el
// backend (HoldingsHistoryRange.startFrom), para que el corte del cliente coincida
// con la ventana que ya devuelve la API.

import type { ChartRange } from "@/types/portfolio-chart";

// Unificado con el contrato del backend: HistoryRange === ChartRange.
export type HistoryRange = ChartRange;

type RangeDef = {
  value: HistoryRange;
  label: string;
  /** Meses de calendario a restar (para 1M/3M/6M/1Y). */
  months: number | null;
  /** Días a restar (para 1D/1S). */
  days: number | null;
};

const RANGE_DEFS: readonly RangeDef[] = [
  { value: "1D", label: "1D", months: null, days: 1 },
  { value: "1S", label: "1S", months: null, days: 7 },
  { value: "1M", label: "1M", months: 1, days: null },
  { value: "3M", label: "3M", months: 3, days: null },
  { value: "6M", label: "6M", months: 6, days: null },
  { value: "1Y", label: "1Y", months: 12, days: null },
  { value: "ALL", label: "ALL", months: null, days: null },
] as const;

/** Opciones para renderizar los botones del selector (value + label). */
export const HISTORY_RANGES: ReadonlyArray<{ value: HistoryRange; label: string }> =
  RANGE_DEFS.map(({ value, label }) => ({ value, label }));

/** Orden de menor a mayor cobertura; usado para auto-expandir cuando faltan datos. */
export const HISTORY_RANGE_ORDER: readonly HistoryRange[] = RANGE_DEFS.map((d) => d.value);

export function getNextRange(current: HistoryRange): HistoryRange | null {
  const idx = HISTORY_RANGE_ORDER.indexOf(current);
  return idx >= 0 && idx < HISTORY_RANGE_ORDER.length - 1 ? HISTORY_RANGE_ORDER[idx + 1] : null;
}

/**
 * Segundo epoch (UTC) a partir del cual la serie es visible para el rango dado.
 * `null` para ALL (sin corte). Meses/años usan aritmética de calendario en UTC.
 */
export function rangeCutoffSeconds(range: HistoryRange, nowSeconds?: number): number | null {
  const def = RANGE_DEFS.find((d) => d.value === range);
  if (!def || (def.months === null && def.days === null)) return null;

  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  const date = new Date(now * 1000);

  if (def.days !== null) {
    date.setUTCDate(date.getUTCDate() - def.days);
    return Math.floor(date.getTime() / 1000);
  }

  // Meses/años: recortar al último día válido del mes destino, igual que Java
  // Period.minusMonths (2026-03-31 − 6m → 2025-09-30), NO desbordar como haría
  // el setUTCMonth nativo (→ 2025-10-01).
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth() - (def.months as number);
  const target = new Date(Date.UTC(year, monthIndex, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const clampedDay = Math.min(date.getUTCDate(), lastDayOfTargetMonth);
  const result = new Date(
    Date.UTC(
      target.getUTCFullYear(),
      target.getUTCMonth(),
      clampedDay,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
    ),
  );
  return Math.floor(result.getTime() / 1000);
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
