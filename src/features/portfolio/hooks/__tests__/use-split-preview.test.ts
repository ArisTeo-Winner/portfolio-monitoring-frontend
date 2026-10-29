import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSplitPreview } from "../use-split-preview";
import { getSplitPreview } from "@/features/portfolio/api/get-split-preview";
import type { SplitPreviewResponse } from "@/features/portfolio/types/split-preview.types";

vi.mock("@/features/portfolio/api/get-split-preview", () => ({
  getSplitPreview: vi.fn(),
}));

const mockedGetSplitPreview = vi.mocked(getSplitPreview);

const FORWARD: SplitPreviewResponse = {
  splitDetected: true,
  splitType: "FORWARD",
  factor: 10,
  splits: [{ ratio: "10-for-1", executionDate: "2024-06-07", shareMultiplier: 10 }],
  original: { quantity: 10, pricePerUnit: 900 },
  adjusted: { quantity: 100, pricePerUnit: 90 },
  note: null,
};

const BASE = {
  symbol: "NVDA",
  transactionDate: "2024-05-01T12:00:00Z",
  quantity: 10,
  pricePerUnit: 900,
  enabled: true,
  debounceMs: 0,
};

describe("useSplitPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call the API and stays null when disabled", async () => {
    mockedGetSplitPreview.mockResolvedValue(FORWARD);
    const { result } = renderHook(() => useSplitPreview({ ...BASE, enabled: false }));

    // Give any (wrongly scheduled) debounce a chance to fire.
    await new Promise((r) => setTimeout(r, 10));

    expect(mockedGetSplitPreview).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("does not call the API when the symbol is missing", async () => {
    mockedGetSplitPreview.mockResolvedValue(FORWARD);
    renderHook(() => useSplitPreview({ ...BASE, symbol: "" }));

    await new Promise((r) => setTimeout(r, 10));
    expect(mockedGetSplitPreview).not.toHaveBeenCalled();
  });

  it("fetches and exposes the preview when enabled", async () => {
    mockedGetSplitPreview.mockResolvedValue(FORWARD);
    const { result } = renderHook(() => useSplitPreview(BASE));

    await waitFor(() => expect(result.current.data).toEqual(FORWARD));
    expect(result.current.loading).toBe(false);
    expect(mockedGetSplitPreview).toHaveBeenCalledWith(
      { symbol: "NVDA", transactionDate: "2024-05-01T12:00:00Z", quantity: 10, pricePerUnit: 900 },
      expect.any(AbortSignal),
    );
  });

  it("swallows errors and leaves data null (never blocks the UI)", async () => {
    mockedGetSplitPreview.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useSplitPreview(BASE));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
  });

  it("does not re-query identical inputs across re-renders", async () => {
    mockedGetSplitPreview.mockResolvedValue(FORWARD);
    const { result, rerender } = renderHook((props) => useSplitPreview(props), { initialProps: BASE });

    await waitFor(() => expect(result.current.data).toEqual(FORWARD));
    rerender({ ...BASE });
    await new Promise((r) => setTimeout(r, 10));

    expect(mockedGetSplitPreview).toHaveBeenCalledTimes(1);
  });
});
