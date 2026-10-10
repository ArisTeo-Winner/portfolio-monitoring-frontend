import type { MarketCode } from "@/features/market/types/market-status.types";

// FALLBACK DATA ONLY. The backend (ADR-0012) is the source of truth and seeds the
// official BMV/BIVA + NYSE calendars year by year. This local copy powers the
// client-side fallback when the endpoint is unreachable (429 / network down).
//
// 2026 calendar — VERIFIED 1:1 against the official calendars (2026-10-07, cross-
// checked with backend). Re-verify and extend each year.

export type Holiday = {
  date: string; // "YYYY-MM-DD"
  name: string;
  type: "full" | "early";
  close?: string; // early-close time, local "HH:mm"
};

export type MarketDef = {
  code: MarketCode;
  label: string;
  exchange: string;
  timezone: string;
  open: string;
  close: string;
  extended: boolean;
  preOpen?: string;
  afterClose?: string;
  earlyClose?: string;
  earlyAfterClose?: string;
  holidays: Holiday[];
  holidaysByDate: Record<string, Holiday>;
};

const indexByDate = (hs: Holiday[]): Record<string, Holiday> =>
  Object.fromEntries(hs.map((h) => [h.date, h]));

// BMV / BIVA — 9 full closures. México has no DST (CST fixed) and no retail extended hours.
const BMV_HOLIDAYS: Holiday[] = [
  { date: "2026-01-01", name: "Año Nuevo", type: "full" },
  { date: "2026-02-02", name: "Día de la Constitución", type: "full" },
  { date: "2026-03-16", name: "Natalicio de Benito Juárez", type: "full" },
  { date: "2026-04-02", name: "Jueves Santo", type: "full" },
  { date: "2026-04-03", name: "Viernes Santo", type: "full" },
  { date: "2026-05-01", name: "Día del Trabajo", type: "full" },
  { date: "2026-09-16", name: "Día de la Independencia", type: "full" },
  { date: "2026-11-16", name: "Día de la Revolución", type: "full" },
  { date: "2026-12-25", name: "Navidad", type: "full" },
];

// NYSE / NASDAQ — 10 full closures + 2 early closes (13:00 ET, after-hours to 17:00 ET). Observes DST.
const NYSE_HOLIDAYS: Holiday[] = [
  { date: "2026-01-01", name: "New Year's Day", type: "full" },
  { date: "2026-01-19", name: "Martin Luther King, Jr. Day", type: "full" },
  { date: "2026-02-16", name: "Washington's Birthday", type: "full" },
  { date: "2026-04-03", name: "Good Friday", type: "full" },
  { date: "2026-05-25", name: "Memorial Day", type: "full" },
  { date: "2026-06-19", name: "Juneteenth", type: "full" },
  { date: "2026-07-03", name: "Independence Day (observado)", type: "full" },
  { date: "2026-09-07", name: "Labor Day", type: "full" },
  { date: "2026-11-26", name: "Thanksgiving", type: "full" },
  { date: "2026-11-27", name: "Día posterior a Thanksgiving", type: "early", close: "13:00" },
  { date: "2026-12-24", name: "Nochebuena", type: "early", close: "13:00" },
  { date: "2026-12-25", name: "Christmas Day", type: "full" },
];

export const MARKETS: Record<MarketCode, MarketDef> = {
  BMV: {
    code: "BMV",
    label: "México y SIC",
    exchange: "BMV · BIVA · SIC",
    timezone: "America/Mexico_City",
    open: "08:30",
    close: "15:00",
    extended: false,
    holidays: BMV_HOLIDAYS,
    holidaysByDate: indexByDate(BMV_HOLIDAYS),
  },
  NYSE: {
    code: "NYSE",
    label: "Estados Unidos",
    exchange: "NYSE · NASDAQ",
    timezone: "America/New_York",
    open: "09:30",
    close: "16:00",
    extended: true,
    preOpen: "04:00",
    afterClose: "20:00",
    earlyClose: "13:00",
    earlyAfterClose: "17:00",
    holidays: NYSE_HOLIDAYS,
    holidaysByDate: indexByDate(NYSE_HOLIDAYS),
  },
};
