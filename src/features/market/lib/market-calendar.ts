import { MARKETS } from "@/features/market/lib/market-calendar.data";
import type {
  MarketCode,
  MarketPhase,
  MarketReasonCode,
  MarketStatus,
} from "@/features/market/types/market-status.types";

// Pure, DOM-free, network-free engine. Mirrors the backend status computation so it
// can serve as a graceful-degradation fallback. Uses Intl timeZone (not fixed
// offsets) so DST is handled correctly all year (NYSE EST/EDT; BMV CST fixed).

const toMin = (s: string): number => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
const ymd = (y: number, m: number, d: number): string =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

type TzParts = { y: number; m: number; d: number; hh: number; mm: number; ss: number };

function tzParts(tz: string, date: Date): TzParts {
  const o: Record<string, string> = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(date)
    .forEach((p) => {
      if (p.type !== "literal") o[p.type] = p.value;
    });
  return { y: +o.year, m: +o.month, d: +o.day, hh: +o.hour % 24, mm: +o.minute, ss: +o.second };
}

function tzOffsetMs(tz: string, date: Date): number {
  const p = tzParts(tz, date);
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - date.getTime();
}

/** The UTC instant at which it is `min` minutes-of-day on y-m-d in the given tz. */
function instantFor(tz: string, y: number, m: number, d: number, min: number): Date {
  const naive = Date.UTC(y, m - 1, d, Math.floor(min / 60), min % 60, 0);
  return new Date(naive - tzOffsetMs(tz, new Date(naive)));
}

type DayInfo = { type: "trading" | "early" | "weekend" | "full"; name?: string; close?: string };

function dayInfo(code: MarketCode, y: number, m: number, d: number): DayInfo {
  const mk = MARKETS[code];
  const h = mk.holidaysByDate[ymd(y, m, d)];
  if (h?.type === "full") return { type: "full", name: h.name };
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (wd === 0 || wd === 6) return { type: "weekend" };
  if (h?.type === "early") return { type: "early", name: h.name, close: h.close };
  return { type: "trading" };
}

function nextRegularChange(
  code: MarketCode,
  phase: MarketPhase,
  p: TzParts,
  openMin: number,
  closeMin: number,
  dayType: DayInfo["type"],
): MarketStatus["nextChange"] {
  const tz = MARKETS[code].timezone;
  if (phase === "OPEN") return { type: "CLOSE", at: instantFor(tz, p.y, p.m, p.d, closeMin).toISOString() };
  if (phase === "PRE_MARKET") return { type: "OPEN", at: instantFor(tz, p.y, p.m, p.d, openMin).toISOString() };
  // CLOSED / AFTER_HOURS → next trading day's regular open (today only if before open).
  const minutes = p.hh * 60 + p.mm;
  const beforeOpen = (dayType === "trading" || dayType === "early") && minutes < openMin;
  for (let i = 0; i <= 14; i++) {
    const base = new Date(Date.UTC(p.y, p.m - 1, p.d));
    base.setUTCDate(base.getUTCDate() + i);
    const yy = base.getUTCFullYear();
    const mm = base.getUTCMonth() + 1;
    const dd = base.getUTCDate();
    const t = dayInfo(code, yy, mm, dd).type;
    if ((t === "trading" || t === "early") && (i > 0 || beforeOpen)) {
      return { type: "OPEN", at: instantFor(tz, yy, mm, dd, openMin).toISOString() };
    }
  }
  return null;
}

/** Fallback: computes a market's status as the backend would. `now` is injectable for tests. */
export function computeMarketStatus(code: MarketCode, now: Date = new Date()): MarketStatus {
  const mk = MARKETS[code];
  const p = tzParts(mk.timezone, now);
  const info = dayInfo(code, p.y, p.m, p.d);
  const openMin = toMin(mk.open);
  let closeMin = toMin(mk.close);
  let phase: MarketPhase = "CLOSED";
  let reasonCode: MarketReasonCode = "AFTER_CLOSE";

  if (info.type === "full") {
    reasonCode = "HOLIDAY";
  } else if (info.type === "weekend") {
    reasonCode = "WEEKEND";
  } else {
    const early = info.type === "early";
    if (early) closeMin = toMin(info.close ?? mk.earlyClose ?? mk.close);
    const minutes = p.hh * 60 + p.mm;
    if (mk.extended) {
      const preStart = toMin(mk.preOpen ?? "04:00");
      const afterEnd = toMin(early ? (mk.earlyAfterClose ?? "17:00") : (mk.afterClose ?? "20:00"));
      if (minutes < preStart) reasonCode = "BEFORE_OPEN";
      else if (minutes < openMin) {
        phase = "PRE_MARKET";
        reasonCode = "PRE_MARKET";
      } else if (minutes < closeMin) {
        phase = "OPEN";
        reasonCode = early ? "EARLY_CLOSE" : "REGULAR";
      } else if (minutes < afterEnd) {
        phase = "AFTER_HOURS";
        reasonCode = "AFTER_HOURS";
      } else {
        reasonCode = "AFTER_CLOSE";
      }
    } else if (minutes >= openMin && minutes < closeMin) {
      phase = "OPEN";
      reasonCode = early ? "EARLY_CLOSE" : "REGULAR";
    } else {
      reasonCode = minutes < openMin ? "BEFORE_OPEN" : "AFTER_CLOSE";
    }
  }

  return {
    code,
    label: mk.label,
    exchange: mk.exchange,
    timezone: mk.timezone,
    phase,
    isOpen: phase === "OPEN",
    regular: { open: mk.open, close: mk.close },
    extended: mk.extended ? { pre: mk.preOpen ?? "04:00", after: mk.afterClose ?? "20:00" } : null,
    nextChange: nextRegularChange(code, phase, p, openMin, closeMin, info.type),
    reasonCode,
  };
}

/** Both markets (header order: NYSE then BMV, like the backend sample). */
export function computeAllMarkets(now: Date = new Date()): MarketStatus[] {
  return [computeMarketStatus("NYSE", now), computeMarketStatus("BMV", now)];
}
