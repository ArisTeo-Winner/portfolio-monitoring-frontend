import { describe, it, expect } from "vitest";
import { formatTradeDate, tradeDateLabel, executionSortMs } from "@/features/transactions/lib/transaction-datetime";

const base = {
  localExecutionTime: null as string | null,
  executionZoneId: null as string | null,
  executedAtUtc: null as string | null,
  transactionDate: "2025-06-24T00:00:00Z",
};

describe("formatTradeDate — binomial present", () => {
  it("renders the plaza wall-clock tagged with the plaza (NY), day not shifted", () => {
    const d = formatTradeDate({
      ...base,
      localExecutionTime: "2025-06-24T11:27:29",
      executionZoneId: "America/New_York",
      executedAtUtc: "2025-06-24T15:27:29Z",
    });
    expect(d.dateLabel).toMatch(/24/);
    expect(d.dateLabel).toMatch(/2025/);
    expect(d.timeLabel).toMatch(/11:27/);
    expect(d.zoneTag).toBe("NY");
    expect(tradeDateLabel({
      ...base,
      localExecutionTime: "2025-06-24T11:27:29",
      executionZoneId: "America/New_York",
    })).toMatch(/\(NY\)$/);
  });

  it("maps Mexico_City to MX", () => {
    const d = formatTradeDate({ ...base, localExecutionTime: "2025-06-24T09:15:00", executionZoneId: "America/Mexico_City" });
    expect(d.zoneTag).toBe("MX");
  });

  it("00:00 sentinel → date only (no time)", () => {
    const d = formatTradeDate({ ...base, localExecutionTime: "2025-06-24T00:00:00", executionZoneId: "UTC" });
    expect(d.timeLabel).toBeNull();
    expect(d.zoneTag).toBe("UTC");
    expect(d.dateLabel).toMatch(/24/);
  });
});

describe("formatTradeDate — legacy fallback", () => {
  it("uses transactionDate with no plaza tag when the binomial is absent", () => {
    const d = formatTradeDate(base);
    expect(d.zoneTag).toBeNull();
    expect(d.dateLabel).not.toBe("--");
    expect(d.dateLabel.length).toBeGreaterThan(0);
  });

  it("handles an invalid date without throwing", () => {
    const d = formatTradeDate({ ...base, transactionDate: "not-a-date" });
    expect(d.dateLabel).toBe("--");
    expect(d.timeLabel).toBeNull();
  });
});

describe("executionSortMs", () => {
  it("uses executedAtUtc when present", () => {
    expect(executionSortMs({ executedAtUtc: "2025-06-24T15:27:29Z", transactionDate: "2025-01-01T00:00:00Z" }))
      .toBe(Date.parse("2025-06-24T15:27:29Z"));
  });
  it("falls back to transactionDate", () => {
    expect(executionSortMs({ executedAtUtc: null, transactionDate: "2025-06-24T00:00:00Z" }))
      .toBe(Date.parse("2025-06-24T00:00:00Z"));
  });
  it("orders a NY afternoon trade after a same-day BMV morning trade (by UTC instant)", () => {
    const bmv = { executedAtUtc: "2025-06-24T15:00:00Z", transactionDate: "x" }; // 09:00 CDMX
    const nyse = { executedAtUtc: "2025-06-24T19:00:00Z", transactionDate: "x" }; // 15:00 ET
    expect(executionSortMs(nyse)).toBeGreaterThan(executionSortMs(bmv));
  });
});
