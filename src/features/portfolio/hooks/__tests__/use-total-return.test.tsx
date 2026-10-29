import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTotalReturn } from "@/features/portfolio/hooks/use-total-return";
import type { PortfolioSummaryResponse } from "@/features/portfolio/types/portfolio-summary.types";
import { apiRequest } from "@/lib/api/client";

vi.mock("@/lib/api/client", () => ({ apiRequest: vi.fn() }));
const mockedApiRequest = vi.mocked(apiRequest);

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function buildSummary(extra: Partial<PortfolioSummaryResponse>): PortfolioSummaryResponse {
  return {
    costBasis: 20,
    allTimeProfit: 6,
    allTimeProfitPercent: 45,
    dividendIncome: null,
    totalReturn: null,
    totalReturnPercent: null,
    ...extra,
  };
}

describe("useTotalReturn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for an empty portfolio (dividend-aware figures null → fallback)", async () => {
    mockedApiRequest.mockResolvedValue(buildSummary({}));
    const { result } = renderHook(() => useTotalReturn(), { wrapper: createWrapper() });

    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalledTimes(1));
    expect(result.current).toBeNull();
  });

  it("maps price / income / total return when the summary has the fields", async () => {
    // allTimeProfit 6 (price) + dividendIncome 3 = totalReturn 9; 9/20 = 45%.
    mockedApiRequest.mockResolvedValue(
      buildSummary({ dividendIncome: 3, totalReturn: 9, totalReturnPercent: 45 }),
    );
    const { result } = renderHook(() => useTotalReturn(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toMatchObject({
      price: 6,
      income: 3,
      totalReturn: 9,
      totalReturnPercent: 45,
    });
    expect(typeof result.current?.currency).toBe("string");
  });

  it("returns null when the summary endpoint is unavailable (pre-ADR-0014 backend)", async () => {
    mockedApiRequest.mockRejectedValue(new Error("404 Not Found"));
    const { result } = renderHook(() => useTotalReturn(), { wrapper: createWrapper() });

    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalledTimes(1));
    expect(result.current).toBeNull();
  });
});
