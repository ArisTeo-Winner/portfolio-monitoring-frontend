import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMarketStatus, __resetMarketStatusStore } from "@/features/market/hooks/use-market-status";
import { getMarketStatus } from "@/features/market/api/get-market-status";
import { ApiError } from "@/lib/api/problem-details";
import type { MarketStatusResponse } from "@/features/market/types/market-status.types";

vi.mock("@/features/market/api/get-market-status", () => ({ getMarketStatus: vi.fn() }));
const mockedGet = vi.mocked(getMarketStatus);

const LIVE: MarketStatusResponse = {
  asOf: "2026-10-08T21:00:00Z",
  markets: [
    {
      code: "NYSE", label: "Estados Unidos", exchange: "NYSE · NASDAQ",
      timezone: "America/New_York", phase: "OPEN", isOpen: true,
      regular: { open: "09:30", close: "16:00" }, extended: { pre: "04:00", after: "20:00" },
      nextChange: { type: "CLOSE", at: "2026-10-08T20:00:00Z" }, reasonCode: "REGULAR",
    },
    {
      code: "BMV", label: "México y SIC", exchange: "BMV · BIVA · SIC",
      timezone: "America/Mexico_City", phase: "CLOSED", isOpen: false,
      regular: { open: "08:30", close: "15:00" }, extended: null,
      nextChange: { type: "OPEN", at: "2026-10-09T14:30:00Z" }, reasonCode: "AFTER_CLOSE",
    },
  ],
};

describe("useMarketStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetMarketStatusStore();
  });

  it("renders the client fallback immediately (no empty flash)", () => {
    mockedGet.mockResolvedValue(LIVE);
    const { result } = renderHook(() => useMarketStatus());
    expect(result.current.markets).toHaveLength(2); // NYSE + BMV computed locally
    expect(result.current.source).toBe("fallback");
  });

  it("switches to live on a successful fetch", async () => {
    mockedGet.mockResolvedValue(LIVE);
    const { result } = renderHook(() => useMarketStatus());
    await waitFor(() => expect(result.current.source).toBe("live"));
    expect(result.current.markets).toEqual(LIVE.markets);
    expect(result.current.asOf).toBe(LIVE.asOf);
  });

  it("falls back on a 429 and never throws", async () => {
    mockedGet.mockRejectedValue(new ApiError(429, "rate limited"));
    const { result } = renderHook(() => useMarketStatus());
    await waitFor(() => expect(mockedGet).toHaveBeenCalled());
    expect(result.current.source).toBe("fallback");
    expect(result.current.markets).toHaveLength(2);
  });
});
