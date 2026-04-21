import type { ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import { HoldingsChart } from "@/components/charts/HoldingsChart";
import type { HoldingsPerformanceResponse } from "@/features/portfolio/types/holdings-performance.types";
import { apiRequest } from "@/lib/api/client";

const chartMockState = vi.hoisted(() => ({
  createChart: vi.fn(),
  addSeries: vi.fn(),
  lineSeries: {
    setData: vi.fn(),
  },
  fitContent: vi.fn(),
  subscribeCrosshairMove: vi.fn(),
  unsubscribeCrosshairMove: vi.fn(),
  remove: vi.fn(),
  crosshairHandler: undefined as ((param: unknown) => void) | undefined,
}));

vi.mock("@/lib/api/client", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("lightweight-charts", () => {
  chartMockState.createChart.mockImplementation(() => ({
    addSeries: chartMockState.addSeries.mockImplementation(() => chartMockState.lineSeries),
    subscribeCrosshairMove: chartMockState.subscribeCrosshairMove.mockImplementation((handler) => {
      chartMockState.crosshairHandler = handler;
    }),
    unsubscribeCrosshairMove: chartMockState.unsubscribeCrosshairMove,
    remove: chartMockState.remove,
    timeScale: () => ({
      fitContent: chartMockState.fitContent,
    }),
  }));

  return {
    createChart: chartMockState.createChart,
    LineSeries: "LineSeries",
    ColorType: {
      Solid: "Solid",
    },
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

describe("HoldingsChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chartMockState.crosshairHandler = undefined;
  });

  it("renders the complete backend series for the 5 HYPE transactions without altering values", async () => {
    const response = buildResponse([
      { time: 1733355600, value: 447.63 },
      { time: 1744041600, value: 746.2 },
      { time: 1745062200, value: 990.55 },
      { time: 1751643300, value: 2938.32 },
      { time: 1757542200, value: 0 },
    ]);

    mockedApiRequest.mockResolvedValue(response);

    renderWithClient(<HoldingsChart period="ALL" portfolioId="crypto" />);

    await waitFor(() => {
      expect(chartMockState.lineSeries.setData).toHaveBeenCalledWith(response.series);
    });

    expect(chartMockState.addSeries).toHaveBeenCalledTimes(1);
    expect(chartMockState.createChart).toHaveBeenCalledTimes(1);
  });

  it("shows the exact selected point value inside the custom tooltip", async () => {
    const response = buildResponse([
      { time: 1742519700, value: 2515.26 },
      { time: 1745062200, value: 3028.64 },
      { time: 1775079000, value: 4153.66 },
    ]);

    mockedApiRequest.mockResolvedValue(response);

    renderWithClient(<HoldingsChart portfolioId="crypto" />);

    await waitFor(() => {
      expect(chartMockState.crosshairHandler).toBeTypeOf("function");
    });

    act(() => {
      chartMockState.crosshairHandler?.({
        point: { x: 180, y: 72 },
        time: response.series[1].time,
        seriesData: new Map([[chartMockState.lineSeries, { value: response.series[1].value }]]),
      });
    });

    expect(screen.getByTestId("holdings-chart-tooltip")).toHaveTextContent(
      formatExpectedDate(response.series[1].time),
    );
    expect(screen.getByTestId("holdings-chart-tooltip")).toHaveTextContent("Total Value: $3,028.64");
  });

  it("refetches and updates the series when the period changes", async () => {
    const allResponse = buildResponse([
      { time: 1733355600, value: 447.63 },
      { time: 1744041600, value: 746.2 },
      { time: 1745062200, value: 990.55 },
    ]);
    const sevenDayResponse = buildResponse([
      { time: 1775075400, value: 3900.12 },
      { time: 1775079000, value: 4153.66 },
    ]);

    mockedApiRequest.mockImplementation(async (path) => {
      if (String(path).includes("period=7d")) {
        return sevenDayResponse;
      }

      return allResponse;
    });

    renderWithClient(<HoldingsChart period="ALL" portfolioId="crypto" />);

    await waitFor(() => {
      expect(chartMockState.lineSeries.setData).toHaveBeenCalledWith(allResponse.series);
    });

    await userEvent.click(screen.getByRole("button", { name: "7d" }));

    await waitFor(() => {
      expect(mockedApiRequest).toHaveBeenCalledWith(
        "/api/v1/me/portfolio/crypto/holdings-performance?period=7d",
        { auth: true },
      );
    });

    await waitFor(() => {
      expect(chartMockState.lineSeries.setData).toHaveBeenLastCalledWith(sevenDayResponse.series);
    });
  });

  it("keeps the series 100% identical to the backend payload", async () => {
    const backendResponse = buildResponse([
      { time: 1733355600, value: 447.63 },
      { time: 1744041600, value: 746.2 },
      { time: 1745062200, value: 990.55 },
      { time: 1751643300, value: 2938.32 },
      { time: 1757542200, value: 0 },
    ]);
    const originalSeries = structuredClone(backendResponse.series);

    mockedApiRequest.mockResolvedValue(backendResponse);

    renderWithClient(<HoldingsChart portfolioId="crypto" />);

    await waitFor(() => {
      expect(chartMockState.lineSeries.setData).toHaveBeenCalled();
    });

    expect(chartMockState.lineSeries.setData.mock.calls.at(-1)?.[0]).toStrictEqual(originalSeries);
    expect(backendResponse.series).toStrictEqual(originalSeries);
  });
});

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function buildResponse(series: HoldingsPerformanceResponse["series"]): HoldingsPerformanceResponse {
  return {
    series,
    isProfit: true,
    allTimeProfit: 140.65,
    costBasis: 4012.75,
  };
}

function formatExpectedDate(unixTimestamp: number) {
  return new Date(unixTimestamp * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
