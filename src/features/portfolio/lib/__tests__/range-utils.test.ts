import { describe, expect, it } from "vitest";

import {
  filterSeriesByRange,
  getNextRange,
  HISTORY_RANGES,
  HISTORY_RANGE_ORDER,
  rangeCutoffSeconds,
  type HistoryRange,
} from "../range-utils";

// 2026-03-31T00:00:00Z — fin de mes con día 31, para exponer la diferencia
// entre "1 mes calendario" (28-feb) y "30 días fijos" (01-mar).
const NOW = Math.floor(Date.parse("2026-03-31T00:00:00Z") / 1000);
const DAY = 86_400;

function seriesAt(...isoDates: string[]) {
  return isoDates.map((iso) => ({ time: Math.floor(Date.parse(iso) / 1000), value: 1 }));
}

describe("HISTORY_RANGES / order", () => {
  it("expone los 7 tokens canónicos en orden", () => {
    expect(HISTORY_RANGES.map((r) => r.value)).toEqual([
      "1D",
      "1S",
      "1M",
      "3M",
      "6M",
      "1Y",
      "ALL",
    ]);
    expect(HISTORY_RANGE_ORDER).toEqual(["1D", "1S", "1M", "3M", "6M", "1Y", "ALL"]);
  });

  it("las etiquetas coinciden con el token", () => {
    expect(HISTORY_RANGES.map((r) => r.label)).toEqual(["1D", "1S", "1M", "3M", "6M", "1Y", "ALL"]);
  });
});

describe("getNextRange", () => {
  it("avanza al siguiente rango de mayor cobertura", () => {
    expect(getNextRange("1D")).toBe("1S");
    expect(getNextRange("1M")).toBe("3M");
    expect(getNextRange("1Y")).toBe("ALL");
  });

  it("ALL no tiene siguiente", () => {
    expect(getNextRange("ALL")).toBeNull();
  });
});

describe("rangeCutoffSeconds — calendario, no días fijos", () => {
  it("1D/1S restan días", () => {
    expect(rangeCutoffSeconds("1D", NOW)).toBe(NOW - 1 * DAY);
    expect(rangeCutoffSeconds("1S", NOW)).toBe(NOW - 7 * DAY);
  });

  it("1M es un mes de calendario (31-mar → 28-feb), no 30 días", () => {
    const expected = Math.floor(Date.parse("2026-02-28T00:00:00Z") / 1000);
    expect(rangeCutoffSeconds("1M", NOW)).toBe(expected);
    expect(rangeCutoffSeconds("1M", NOW)).not.toBe(NOW - 30 * DAY);
  });

  it("3M/6M/1Y restan meses/años de calendario", () => {
    expect(rangeCutoffSeconds("3M", NOW)).toBe(
      Math.floor(Date.parse("2025-12-31T00:00:00Z") / 1000),
    );
    expect(rangeCutoffSeconds("6M", NOW)).toBe(
      Math.floor(Date.parse("2025-09-30T00:00:00Z") / 1000),
    );
    expect(rangeCutoffSeconds("1Y", NOW)).toBe(
      Math.floor(Date.parse("2025-03-31T00:00:00Z") / 1000),
    );
  });

  it("ALL no tiene corte", () => {
    expect(rangeCutoffSeconds("ALL", NOW)).toBeNull();
  });
});

describe("filterSeriesByRange", () => {
  it("mantiene puntos en o después del corte", () => {
    const series = seriesAt("2026-02-27T00:00:00Z", "2026-03-15T00:00:00Z", "2026-03-30T00:00:00Z");
    // 1M corta en 28-feb: descarta el punto del 27-feb
    expect(filterSeriesByRange(series, "1M", NOW)).toHaveLength(2);
  });

  it("ALL devuelve la serie completa", () => {
    const series = seriesAt("2020-01-01T00:00:00Z", "2026-03-30T00:00:00Z");
    expect(filterSeriesByRange(series, "ALL", NOW)).toStrictEqual(series);
  });

  it("serie vacía se mantiene vacía para cualquier rango", () => {
    (HISTORY_RANGE_ORDER as HistoryRange[]).forEach((range) => {
      expect(filterSeriesByRange([], range, NOW)).toStrictEqual([]);
    });
  });
});
