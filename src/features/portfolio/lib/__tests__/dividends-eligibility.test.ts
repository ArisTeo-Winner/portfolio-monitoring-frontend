import { describe, expect, it } from "vitest";
import {
  dividendStatusBadge,
  formatDividendDate,
  frequencyLabel,
  pickSoonestDividend,
  resolveDividendStatus,
} from "@/features/portfolio/lib/dividends-eligibility";
import type { NextDividend } from "@/features/market/types/dividend-growth.types";

describe("resolveDividendStatus", () => {
  it("maps the backend enum to a display status", () => {
    expect(resolveDividendStatus("PAYS", 0)).toBe("pays");
    expect(resolveDividendStatus("NONE", 0)).toBe("none");
    expect(resolveDividendStatus("ERROR", 0)).toBe("verifying");
    expect(resolveDividendStatus("UNKNOWN", 0)).toBe("verifying");
  });

  it("never treats ERROR/UNKNOWN as a confirmed non-payer", () => {
    // Even with zero computed income, an unverified name must read "verifying".
    expect(resolveDividendStatus("ERROR", 0)).not.toBe("none");
    expect(resolveDividendStatus("UNKNOWN", 0)).not.toBe("none");
  });

  it("falls back to inferring from income when the field is absent (pre-deploy)", () => {
    expect(resolveDividendStatus(undefined, 120)).toBe("pays");
    expect(resolveDividendStatus(undefined, 0)).toBe("none");
    expect(resolveDividendStatus(null, 0)).toBe("none");
  });
});

describe("dividendStatusBadge", () => {
  it("labels in es-MX with the right tone, owned by the front", () => {
    expect(dividendStatusBadge("pays")).toEqual({ label: "Paga dividendos", tone: "positive" });
    expect(dividendStatusBadge("none")).toEqual({ label: "No reparte dividendos", tone: "neutral" });
    expect(dividendStatusBadge("verifying")).toEqual({ label: "Verificando…", tone: "pending" });
  });
});

describe("frequencyLabel", () => {
  it("names the common cadences and returns null otherwise", () => {
    expect(frequencyLabel(1)).toBe("anual");
    expect(frequencyLabel(2)).toBe("semestral");
    expect(frequencyLabel(4)).toBe("trimestral");
    expect(frequencyLabel(12)).toBe("mensual");
    expect(frequencyLabel(3)).toBeNull();
    expect(frequencyLabel(null)).toBeNull();
    expect(frequencyLabel(undefined)).toBeNull();
  });
});

describe("formatDividendDate", () => {
  it("formats yyyy-MM-dd without a timezone shift", () => {
    // Parsed as a local date: the 10th must stay the 10th, never roll back a day.
    expect(formatDividendDate("2026-03-10")).toMatch(/10/);
    expect(formatDividendDate("2026-03-10")).toMatch(/2026/);
  });

  it("returns null for empty or malformed input", () => {
    expect(formatDividendDate(null)).toBeNull();
    expect(formatDividendDate(undefined)).toBeNull();
    expect(formatDividendDate("")).toBeNull();
    expect(formatDividendDate("not-a-date")).toBeNull();
  });
});

describe("pickSoonestDividend", () => {
  const nd = (paymentDate: string | null, exDividendDate: string | null = null): NextDividend => ({
    exDividendDate,
    paymentDate,
    amountPerShare: 0.2,
    currency: "USD",
    frequency: 4,
  });

  it("returns null when nothing has an upcoming payment", () => {
    expect(pickSoonestDividend([{ nextDividend: null }], "2026-01-01")).toBeNull();
    expect(pickSoonestDividend([], "2026-01-01")).toBeNull();
  });

  it("picks the earliest upcoming payment across holdings", () => {
    const items = [
      { symbol: "AAPL", nextDividend: nd("2026-05-15") },
      { symbol: "KO", nextDividend: nd("2026-03-24") },
      { symbol: "MSFT", nextDividend: nd("2026-09-10") },
    ];
    const soonest = pickSoonestDividend(items, "2026-01-01");
    expect(soonest?.item.symbol).toBe("KO");
    expect(soonest?.keyDate).toBe("2026-03-24");
  });

  it("drops payments strictly before today", () => {
    const items = [
      { symbol: "OLD", nextDividend: nd("2025-12-01") },
      { symbol: "NEW", nextDividend: nd("2026-04-01") },
    ];
    expect(pickSoonestDividend(items, "2026-01-01")?.item.symbol).toBe("NEW");
  });

  it("falls back to the ex-dividend date when no payment date is set", () => {
    const items = [{ symbol: "X", nextDividend: nd(null, "2026-02-02") }];
    expect(pickSoonestDividend(items, "2026-01-01")?.keyDate).toBe("2026-02-02");
  });
});
