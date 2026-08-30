import { describe, it, expect } from "vitest";
import {
  rangeToSeconds,
  rangeCutoffSeconds,
  filterSeriesByRange,
  type HistoryRange,
} from "../range-utils";

// Fixed reference: 2026-05-18T00:00:00Z = 1747526400
const NOW = 1747526400;

const DAY = 24 * 60 * 60;

describe("rangeToSeconds", () => {
  it("returns correct seconds for 24h", () => {
    expect(rangeToSeconds("24h")).toBe(DAY);
  });

  it("returns correct seconds for 7d", () => {
    expect(rangeToSeconds("7d")).toBe(7 * DAY);
  });

  it("returns correct seconds for 30d", () => {
    expect(rangeToSeconds("30d")).toBe(30 * DAY);
  });

  it("returns correct seconds for 90d", () => {
    expect(rangeToSeconds("90d")).toBe(90 * DAY);
  });

  it("returns null for ALL", () => {
    expect(rangeToSeconds("ALL")).toBeNull();
  });
});

describe("rangeCutoffSeconds", () => {
  it("returns now - 24h for 24h", () => {
    expect(rangeCutoffSeconds("24h", NOW)).toBe(NOW - DAY);
  });

  it("returns now - 7d for 7d", () => {
    expect(rangeCutoffSeconds("7d", NOW)).toBe(NOW - 7 * DAY);
  });

  it("returns now - 30d for 30d", () => {
    expect(rangeCutoffSeconds("30d", NOW)).toBe(NOW - 30 * DAY);
  });

  it("returns now - 90d for 90d", () => {
    expect(rangeCutoffSeconds("90d", NOW)).toBe(NOW - 90 * DAY);
  });

  it("returns null for ALL", () => {
    expect(rangeCutoffSeconds("ALL", NOW)).toBeNull();
  });

  it("uses Date.now when nowSeconds is omitted", () => {
    const before = Math.floor(Date.now() / 1000) - 30 * DAY;
    const result = rangeCutoffSeconds("30d");
    const after = Math.floor(Date.now() / 1000) - 30 * DAY;
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });
});

describe("filterSeriesByRange", () => {
  const point = (daysAgo: number) => ({ time: NOW - daysAgo * DAY, value: daysAgo * 100 });

  // ── 30d ──────────────────────────────────────────────────────────────
  it("30d: includes point exactly at cutoff boundary", () => {
    const cutoff = NOW - 30 * DAY;
    const series = [{ time: cutoff, value: 1 }];
    expect(filterSeriesByRange(series, "30d", NOW)).toHaveLength(1);
  });

  it("30d: excludes point 1 second before cutoff", () => {
    const series = [{ time: NOW - 30 * DAY - 1, value: 1 }];
    expect(filterSeriesByRange(series, "30d", NOW)).toHaveLength(0);
  });

  it("30d: keeps only points within the last 30 days", () => {
    const series = [
      point(40), // outside — April 8
      point(35), // outside — April 13
      point(30), // boundary — April 18  ← included
      point(20), // inside  — April 28
      point(10), // inside  — May 8
      point(1),  // inside  — May 17
    ];
    const result = filterSeriesByRange(series, "30d", NOW);
    expect(result).toHaveLength(4);
    expect(result.map((p) => p.value)).toEqual([3000, 2000, 1000, 100]);
  });

  it("30d: returns empty array when all points are outside range", () => {
    const series = [point(60), point(45), point(31)];
    expect(filterSeriesByRange(series, "30d", NOW)).toHaveLength(0);
  });

  it("30d: returns all points when all are within range", () => {
    const series = [point(29), point(15), point(1)];
    expect(filterSeriesByRange(series, "30d", NOW)).toHaveLength(3);
  });

  // ── 7d ───────────────────────────────────────────────────────────────
  it("7d: keeps only points from the last 7 days", () => {
    const series = [point(8), point(7), point(3), point(0)];
    const result = filterSeriesByRange(series, "7d", NOW);
    expect(result).toHaveLength(3);
    expect(result[0].time).toBe(NOW - 7 * DAY);
  });

  // ── 24h ──────────────────────────────────────────────────────────────
  it("24h: keeps only points from the last 24 hours", () => {
    const halfDay = Math.floor(DAY / 2);
    const series = [
      { time: NOW - DAY - 1, value: 1 }, // outside
      { time: NOW - DAY, value: 2 },     // boundary — included
      { time: NOW - halfDay, value: 3 }, // inside
      { time: NOW, value: 4 },           // now
    ];
    const result = filterSeriesByRange(series, "24h", NOW);
    expect(result).toHaveLength(3);
    expect(result[0].value).toBe(2);
  });

  // ── 90d ──────────────────────────────────────────────────────────────
  it("90d: includes points within 90 days and excludes older ones", () => {
    const series = [point(91), point(90), point(60), point(1)];
    const result = filterSeriesByRange(series, "90d", NOW);
    expect(result).toHaveLength(3);
    expect(result[0].time).toBe(NOW - 90 * DAY);
  });

  // ── ALL ───────────────────────────────────────────────────────────────
  it("ALL: returns full series without any filtering", () => {
    const series = [point(365), point(200), point(90), point(1)];
    expect(filterSeriesByRange(series, "ALL", NOW)).toStrictEqual(series);
  });

  it("ALL: returns empty array unchanged", () => {
    expect(filterSeriesByRange([], "ALL", NOW)).toStrictEqual([]);
  });

  // ── Edge cases ───────────────────────────────────────────────────────
  it("returns empty array when series is empty for any range", () => {
    const ranges: HistoryRange[] = ["24h", "7d", "30d", "90d", "ALL"];
    for (const range of ranges) {
      expect(filterSeriesByRange([], range, NOW)).toStrictEqual([]);
    }
  });

  it("preserves original series reference for ALL (no new array)", () => {
    const series = [point(100), point(50)];
    const result = filterSeriesByRange(series, "ALL", NOW);
    expect(result).toBe(series);
  });

  it("does not mutate the original series", () => {
    const series = [point(40), point(20), point(5)];
    const original = structuredClone(series);
    filterSeriesByRange(series, "30d", NOW);
    expect(series).toStrictEqual(original);
  });

  it("works with custom time fields (generic constraint)", () => {
    type CustomPoint = { time: number; price: number; volume: number };
    const series: CustomPoint[] = [
      { time: NOW - 40 * DAY, price: 100, volume: 500 },
      { time: NOW - 15 * DAY, price: 200, volume: 800 },
    ];
    const result = filterSeriesByRange(series, "30d", NOW);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(200);
  });

  it("preserves point order (does not sort)", () => {
    const series = [point(5), point(20), point(10)];
    const result = filterSeriesByRange(series, "30d", NOW);
    expect(result.map((p) => p.time)).toEqual(series.map((p) => p.time));
  });
});

describe("filterSeriesByRange — date consistency across range switches", () => {
  it("30d start is earlier than 7d start for the same dataset", () => {
    const series = Array.from({ length: 100 }, (_, i) => ({ time: NOW - i * DAY, value: i }));
    const result7d = filterSeriesByRange(series, "7d", NOW);
    const result30d = filterSeriesByRange(series, "30d", NOW);
    const earliest7d = Math.min(...result7d.map((p) => p.time));
    const earliest30d = Math.min(...result30d.map((p) => p.time));
    expect(earliest30d).toBeLessThan(earliest7d);
  });

  it("90d result is a superset of 30d result", () => {
    const series = Array.from({ length: 100 }, (_, i) => ({ time: NOW - i * DAY, value: i }));
    const result30d = filterSeriesByRange(series, "30d", NOW);
    const result90d = filterSeriesByRange(series, "90d", NOW);
    for (const point of result30d) {
      expect(result90d).toContainEqual(point);
    }
  });

  it("ALL result contains everything in 90d result", () => {
    const series = Array.from({ length: 100 }, (_, i) => ({ time: NOW - i * DAY, value: i }));
    const result90d = filterSeriesByRange(series, "90d", NOW);
    const resultAll = filterSeriesByRange(series, "ALL", NOW);
    for (const point of result90d) {
      expect(resultAll).toContainEqual(point);
    }
  });

  it("selecting 30d never shows data older than 30 days", () => {
    const series = Array.from({ length: 60 }, (_, i) => ({ time: NOW - i * DAY, value: i }));
    const result = filterSeriesByRange(series, "30d", NOW);
    const cutoff = NOW - 30 * DAY;
    for (const point of result) {
      expect(point.time).toBeGreaterThanOrEqual(cutoff);
    }
  });

  it("the earliest point in 30d result is at most 30 days before now", () => {
    const series = Array.from({ length: 60 }, (_, i) => ({ time: NOW - i * DAY, value: i }));
    const result = filterSeriesByRange(series, "30d", NOW);
    expect(result.length).toBeGreaterThan(0);
    const earliest = Math.min(...result.map((p) => p.time));
    expect(earliest).toBeGreaterThanOrEqual(NOW - 30 * DAY);
  });
});
