import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAssetChart } from "../use-asset-chart";
import { apiRequest } from "@/lib/api/client";
import type { AssetHistoryPoint, AssetMarkerPoint } from "@/types/portfolio-chart";

vi.mock("@/lib/api/client", () => ({
  apiRequest: vi.fn(),
}));

const mockedApiRequest = vi.mocked(apiRequest);

const HISTORY: AssetHistoryPoint[] = [
  { time: 1771455644, value: 28.58 },
  { time: 1771459305, value: 28.64 },
  { time: 1779224441, value: 47.92 },
];

const MARKERS: AssetMarkerPoint[] = [
  {
    time: 1768985100,
    position: "belowBar",
    color: "#16a34a",
    shape: "arrowUp",
    text: "BUY 1 HYPE @ 21.18",
  },
];

function mockSuccess(history = HISTORY, markers = MARKERS) {
  mockedApiRequest.mockImplementation(async (url: string) => {
    if (String(url).includes("/markers")) return markers;
    return history;
  });
}

describe("useAssetChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts in loading state", () => {
    mockSuccess();
    const { result } = renderHook(() => useAssetChart("HYPE", "ALL"));
    expect(result.current.loading).toBe(true);
    expect(result.current.history).toBeNull();
    expect(result.current.markers).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("resolves flat array history and markers from backend", async () => {
    mockSuccess();
    const { result } = renderHook(() => useAssetChart("HYPE", "ALL"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.history).toEqual(HISTORY);
    expect(result.current.markers).toEqual(MARKERS);
  });

  it("history preserves exact time/value pairs without mutation", async () => {
    mockSuccess();
    const { result } = renderHook(() => useAssetChart("HYPE", "ALL"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.history).toHaveLength(3);
    expect(result.current.history![0]).toStrictEqual({ time: 1771455644, value: 28.58 });
    expect(result.current.history![2]).toStrictEqual({ time: 1779224441, value: 47.92 });
  });

  it("markers preserve position/color/shape/text from backend", async () => {
    mockSuccess();
    const { result } = renderHook(() => useAssetChart("HYPE", "ALL"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.markers).toHaveLength(1);
    expect(result.current.markers![0]).toStrictEqual({
      time: 1768985100,
      position: "belowBar",
      color: "#16a34a",
      shape: "arrowUp",
      text: "BUY 1 HYPE @ 21.18",
    });
  });

  it("calls both history and markers endpoints in parallel", async () => {
    mockSuccess();
    renderHook(() => useAssetChart("HYPE", "30d"));

    await waitFor(() =>
      expect(mockedApiRequest).toHaveBeenCalledTimes(2),
    );

    const urls = mockedApiRequest.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes("/history") && u.includes("range=30d"))).toBe(true);
    expect(urls.some((u) => u.includes("/markers") && u.includes("range=30d"))).toBe(true);
  });

  it("passes auth: true in options", async () => {
    mockSuccess();
    renderHook(() => useAssetChart("HYPE", "ALL"));

    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalled());

    expect(mockedApiRequest).toHaveBeenCalledWith(
      expect.stringContaining("/history"),
      expect.objectContaining({ auth: true }),
    );
  });

  it("sets error and clears data on API failure", async () => {
    mockedApiRequest.mockRejectedValue(new Error("Network timeout"));
    const { result } = renderHook(() => useAssetChart("HYPE", "ALL"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Network timeout");
    expect(result.current.history).toBeNull();
    expect(result.current.markers).toBeNull();
  });

  it("uses fallback message for non-Error rejections", async () => {
    mockedApiRequest.mockRejectedValue("unexpected string error");
    const { result } = renderHook(() => useAssetChart("HYPE", "ALL"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Failed to load asset chart data");
  });

  it("re-fetches with new range when range changes", async () => {
    const history90: AssetHistoryPoint[] = [{ time: 1775000000, value: 45.0 }];
    const history7: AssetHistoryPoint[] = [{ time: 1779000000, value: 48.0 }];

    mockedApiRequest.mockImplementation(async (url: string) => {
      if (String(url).includes("/markers")) return [];
      if (String(url).includes("range=7d")) return history7;
      return history90;
    });

    const { result, rerender } = renderHook(
      ({ range }: { range: "90d" | "7d" }) => useAssetChart("HYPE", range),
      { initialProps: { range: "90d" } as { range: "90d" | "7d" } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.history).toEqual(history90);

    rerender({ range: "7d" });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.history).toEqual(history7);
  });

  it("re-fetches when symbol changes", async () => {
    const hypeHistory: AssetHistoryPoint[] = [{ time: 1771455644, value: 28.58 }];
    const btcHistory: AssetHistoryPoint[] = [{ time: 1771455644, value: 103000.0 }];

    mockedApiRequest.mockImplementation(async (url: string) => {
      if (String(url).includes("/markers")) return [];
      if (String(url).includes("/BTC/")) return btcHistory;
      return hypeHistory;
    });

    const { result, rerender } = renderHook(
      ({ symbol }: { symbol: string }) => useAssetChart(symbol, "ALL"),
      { initialProps: { symbol: "HYPE" } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.history).toEqual(hypeHistory);

    rerender({ symbol: "BTC" });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.history).toEqual(btcHistory);
  });

  it("handles empty history array without error", async () => {
    mockedApiRequest.mockImplementation(async (url: string) => {
      if (String(url).includes("/markers")) return [];
      return [];
    });

    const { result } = renderHook(() => useAssetChart("HYPE", "24h"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.history).toEqual([]);
    expect(result.current.markers).toEqual([]);
  });

  it("renders chart with history even when markers endpoint fails", async () => {
    mockedApiRequest.mockImplementation(async (url: string) => {
      if (String(url).includes("/markers")) throw new Error("404 Not Found");
      return HISTORY;
    });

    const { result } = renderHook(() => useAssetChart("HYPE", "90d"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // history must render — markers failure must not propagate as error
    expect(result.current.error).toBeNull();
    expect(result.current.history).toEqual(HISTORY);
    expect(result.current.markers).toEqual([]); // fallback vacío
  });

  it("still reports error when history itself fails", async () => {
    mockedApiRequest.mockImplementation(async (url: string) => {
      if (String(url).includes("/markers")) return [];
      throw new Error("500 Server Error");
    });

    const { result } = renderHook(() => useAssetChart("HYPE", "90d"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("500 Server Error");
    expect(result.current.history).toBeNull();
  });
});
