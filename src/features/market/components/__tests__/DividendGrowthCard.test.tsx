import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DividendGrowthCard } from "@/features/market/components/DividendGrowthCard";
import type { DividendGrowthResponse } from "@/features/market/types/dividend-growth.types";

const useDividendGrowthMock = vi.fn();
vi.mock("@/features/market/hooks/use-dividend-growth", () => ({
  useDividendGrowth: (symbol?: string) => useDividendGrowthMock(symbol),
}));

function resp(extra: Partial<DividendGrowthResponse>): DividendGrowthResponse {
  return {
    symbol: "AAPL",
    annualDividends: [],
    cagr1y: null,
    cagr3y: null,
    cagr5y: null,
    cagr10y: null,
    ...extra,
  };
}

describe("DividendGrowthCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders CAGR as a percent derived from the fraction", () => {
    useDividendGrowthMock.mockReturnValue({ data: resp({ cagr1y: 0.0734, cagr5y: 0.12 }) });
    render(<DividendGrowthCard symbol="AAPL" />);
    expect(screen.getByText("+7.34%")).toBeTruthy();
    expect(screen.getByText("+12.00%")).toBeTruthy();
    expect(screen.getByText("Crecimiento de dividendos")).toBeTruthy();
  });

  it("shows an em dash for horizons without enough history", () => {
    useDividendGrowthMock.mockReturnValue({ data: resp({ cagr1y: 0.05 }) });
    render(<DividendGrowthCard symbol="AAPL" />);
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("renders nothing for an asset with no dividend history", () => {
    useDividendGrowthMock.mockReturnValue({ data: resp({}) });
    const { container } = render(<DividendGrowthCard symbol="BTC" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing while the query is still loading", () => {
    useDividendGrowthMock.mockReturnValue({ data: undefined });
    const { container } = render(<DividendGrowthCard symbol="AAPL" />);
    expect(container.firstChild).toBeNull();
  });
});
