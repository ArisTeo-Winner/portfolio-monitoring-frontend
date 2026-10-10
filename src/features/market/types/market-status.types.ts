// Market status contract (ADR-0012). Mirrors the backend GET /api/v1/market/status
// response 1:1. The backend is the source of truth; the client has a pure fallback
// (see lib/market-calendar.ts) for graceful degradation (429 / network down).

export type MarketPhase = "OPEN" | "PRE_MARKET" | "AFTER_HOURS" | "CLOSED";
export type MarketCode = "BMV" | "NYSE";

export type MarketReasonCode =
  | "REGULAR"
  | "EARLY_CLOSE"
  | "PRE_MARKET"
  | "AFTER_HOURS"
  | "BEFORE_OPEN"
  | "AFTER_CLOSE"
  | "WEEKEND"
  | "HOLIDAY";

export type MarketStatus = {
  code: MarketCode;
  label: string;
  exchange: string;
  timezone: string; // IANA, e.g. "America/New_York"
  phase: MarketPhase;
  isOpen: boolean; // phase === "OPEN"
  regular: { open: string; close: string }; // "HH:mm" in the market's local time
  extended: { pre: string; after: string } | null; // null for BMV
  nextChange: { type: "OPEN" | "CLOSE"; at: string } | null; // next REGULAR session change; `at` is ISO-8601 UTC
  reasonCode: MarketReasonCode | string;
};

export type MarketStatusResponse = {
  asOf: string; // ISO-8601 UTC
  markets: MarketStatus[];
};

// UI semaphore: collapses PRE_MARKET/AFTER_HOURS into a single "extended" tone.
export type StatusTone = "open" | "extended" | "closed";

export function toneOf(phase: MarketPhase): StatusTone {
  if (phase === "OPEN") return "open";
  if (phase === "CLOSED") return "closed";
  return "extended";
}

export function phaseLabel(phase: MarketPhase): string {
  switch (phase) {
    case "OPEN":
      return "Abierto";
    case "PRE_MARKET":
      return "Pre-market";
    case "AFTER_HOURS":
      return "Aftermarket";
    default:
      return "Cerrado";
  }
}
