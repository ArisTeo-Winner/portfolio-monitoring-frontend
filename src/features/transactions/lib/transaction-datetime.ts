import type { TransactionResponse } from "@/features/transactions/types/transaction.types";

// ADR-0013 F4 — render the real trade time from the "operation binomial" instead of
// the legacy `transactionDate` (midnight UTC, which shifts the calendar day).
//
// Rules:
//  1. Show `localExecutionTime` (plaza wall-clock) tagged with the plaza derived from
//     `executionZoneId`  →  "24 jun 2025, 11:27 a.m. (NY)".
//  2. Sort chronologically by `executedAtUtc` only (wall-clocks across zones aren't
//     comparable) — see `executionSortMs`.
//  3. Tooltip: `executedAtUtc` converted to the viewer's local time.
//  4. Fallback: if the binomial is absent (legacy rows, F3 backfill pending) use
//     `transactionDate` as before.
//  5. Sentinel 00:00 (GBM statement / migrated without a real time) → date only.

const ZONE_LABEL: Record<string, string> = {
  "America/New_York": "NY",
  "America/Mexico_City": "MX",
  UTC: "UTC",
};

function plazaLabel(zoneId: string): string {
  return ZONE_LABEL[zoneId] ?? (zoneId.split("/").pop() ?? zoneId).replace(/_/g, " ");
}

function parseWallClock(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3], hh: +m[4], mm: +m[5], ss: m[6] ? +m[6] : 0 };
}

const DATE_FMT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const TIME_FMT: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit", hour12: true };

export type TradeDateDisplay = {
  dateLabel: string; // "24 jun 2025"
  timeLabel: string | null; // "11:27 a.m." — null for the 00:00 sentinel
  zoneTag: string | null; // "NY" / "MX" / "UTC" — null on the legacy fallback
  tooltip?: string; // executedAtUtc in the viewer's local time
};

type TradeDateInput = Pick<
  TransactionResponse,
  "localExecutionTime" | "executionZoneId" | "executedAtUtc" | "transactionDate"
>;

export function formatTradeDate(tx: TradeDateInput): TradeDateDisplay {
  const wall = tx.localExecutionTime ? parseWallClock(tx.localExecutionTime) : null;

  if (wall && tx.executionZoneId) {
    // Format the literal plaza wall-clock: build it as a UTC instant and format in UTC
    // so the displayed numbers never shift with the viewer's timezone. The plaza tag
    // tells the viewer which market those numbers belong to.
    const asUtc = new Date(Date.UTC(wall.y, wall.mo - 1, wall.d, wall.hh, wall.mm, wall.ss));
    const sentinel = wall.hh === 0 && wall.mm === 0 && wall.ss === 0;
    return {
      dateLabel: asUtc.toLocaleDateString("es-MX", { ...DATE_FMT, timeZone: "UTC" }),
      timeLabel: sentinel ? null : asUtc.toLocaleTimeString("es-MX", { ...TIME_FMT, timeZone: "UTC" }),
      zoneTag: plazaLabel(tx.executionZoneId),
      tooltip: tx.executedAtUtc ? localTooltip(tx.executedAtUtc) : undefined,
    };
  }

  // Legacy fallback — keep the prior behavior (local conversion of transactionDate).
  const d = new Date(tx.transactionDate);
  if (Number.isNaN(d.getTime())) return { dateLabel: "--", timeLabel: null, zoneTag: null };
  return {
    dateLabel: d.toLocaleDateString("es-MX", DATE_FMT),
    timeLabel: d.toLocaleTimeString("es-MX", TIME_FMT),
    zoneTag: null,
  };
}

/** A single-line label, e.g. "24 jun 2025, 11:27 a.m. (NY)". */
export function tradeDateLabel(tx: TradeDateInput): string {
  const t = formatTradeDate(tx);
  return `${t.dateLabel}${t.timeLabel ? `, ${t.timeLabel}` : ""}${t.zoneTag ? ` (${t.zoneTag})` : ""}`;
}

function localTooltip(executedAtUtc: string): string {
  const d = new Date(executedAtUtc);
  if (Number.isNaN(d.getTime())) return "";
  const local = d.toLocaleString("es-MX", { ...DATE_FMT, ...TIME_FMT });
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    tz = "";
  }
  return `Tu hora local: ${local}${tz ? ` (${tz})` : ""}`;
}

/** Cross-market-comparable sort key: prefer executedAtUtc, fall back to transactionDate. */
export function executionSortMs(tx: Pick<TransactionResponse, "executedAtUtc" | "transactionDate">): number {
  const t = new Date(tx.executedAtUtc ?? tx.transactionDate).getTime();
  return Number.isNaN(t) ? 0 : t;
}
