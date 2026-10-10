import { describe, it, expect } from "vitest";
import { computeMarketStatus } from "@/features/market/lib/market-calendar";

const at = (iso: string) => new Date(iso);

describe("computeMarketStatus — NYSE (extended hours + DST)", () => {
  it("pre-market (05:00 ET summer)", () => {
    expect(computeMarketStatus("NYSE", at("2026-07-06T09:00:00Z")).phase).toBe("PRE_MARKET");
  });
  it("open (10:00 ET summer, UTC-4)", () => {
    expect(computeMarketStatus("NYSE", at("2026-07-06T14:00:00Z")).phase).toBe("OPEN");
  });
  it("after-hours (17:00 ET)", () => {
    expect(computeMarketStatus("NYSE", at("2026-07-06T21:00:00Z")).phase).toBe("AFTER_HOURS");
  });
  it("closed overnight (21:00 ET)", () => {
    expect(computeMarketStatus("NYSE", at("2026-07-07T01:00:00Z")).phase).toBe("CLOSED");
  });
  it("closed before pre-market (03:00 ET)", () => {
    expect(computeMarketStatus("NYSE", at("2026-07-06T07:00:00Z")).phase).toBe("CLOSED");
  });
  it("open in winter (10:00 ET, EST UTC-5)", () => {
    expect(computeMarketStatus("NYSE", at("2026-02-02T15:00:00Z")).phase).toBe("OPEN");
  });
  it("early-close day: OPEN + EARLY_CLOSE before 13:00 ET", () => {
    const s = computeMarketStatus("NYSE", at("2026-11-27T17:30:00Z")); // 12:30 ET
    expect(s.phase).toBe("OPEN");
    expect(s.reasonCode).toBe("EARLY_CLOSE");
  });
  it("early-close day: AFTER_HOURS after 13:00 ET", () => {
    expect(computeMarketStatus("NYSE", at("2026-11-27T19:00:00Z")).phase).toBe("AFTER_HOURS"); // 14:00 ET
  });
  it("holiday is CLOSED with reason HOLIDAY", () => {
    const s = computeMarketStatus("NYSE", at("2026-12-25T15:00:00Z"));
    expect(s.phase).toBe("CLOSED");
    expect(s.reasonCode).toBe("HOLIDAY");
  });
});

describe("computeMarketStatus — BMV (no DST, no extended hours)", () => {
  it("open (09:00 CDMX)", () => {
    const s = computeMarketStatus("BMV", at("2026-01-05T15:00:00Z"));
    expect(s.phase).toBe("OPEN");
    expect(s.extended).toBeNull();
  });
  it("closed after close (16:00 CDMX)", () => {
    expect(computeMarketStatus("BMV", at("2026-01-05T22:00:00Z")).phase).toBe("CLOSED");
  });
  it("never PRE_MARKET or AFTER_HOURS", () => {
    for (const iso of ["2026-01-05T12:00:00Z", "2026-01-05T21:30:00Z", "2026-01-05T13:30:00Z"]) {
      expect(["OPEN", "CLOSED"]).toContain(computeMarketStatus("BMV", at(iso)).phase);
    }
  });
  it("weekend is CLOSED with reason WEEKEND", () => {
    const s = computeMarketStatus("BMV", at("2026-01-03T16:00:00Z")); // Saturday
    expect(s.phase).toBe("CLOSED");
    expect(s.reasonCode).toBe("WEEKEND");
  });
});

describe("nextChange", () => {
  it("points to a future regular OPEN when closed", () => {
    const now = at("2026-01-05T22:00:00Z");
    const s = computeMarketStatus("BMV", now);
    expect(s.nextChange?.type).toBe("OPEN");
    expect(new Date(s.nextChange!.at).getTime()).toBeGreaterThan(now.getTime());
  });
  it("points to today's CLOSE when open", () => {
    const s = computeMarketStatus("NYSE", at("2026-07-06T14:00:00Z"));
    expect(s.nextChange?.type).toBe("CLOSE");
  });
});
