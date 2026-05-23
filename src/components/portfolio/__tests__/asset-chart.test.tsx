"use client";

import { render, screen, waitFor } from "@testing-library/react";
import _userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssetChart } from "@/components/portfolio/asset-chart";
import { apiRequest } from "@/lib/api/client";
import type { AssetHistoryPoint, AssetMarkerPoint } from "@/types/portfolio-chart";

// ── lightweight-charts mock ────────────────────────────────────────────────
const chartMock = vi.hoisted(() => ({
  setData: vi.fn(),
  setMarkers: vi.fn(),
  fitContent: vi.fn(),
  remove: vi.fn(),
  addSeries: vi.fn(),
}));

const createSeriesMarkersMock = vi.hoisted(() => vi.fn());

vi.mock("lightweight-charts", () => {
  chartMock.addSeries.mockReturnValue(chartMock);

  return {
    createChart: vi.fn(() => ({
      addSeries: chartMock.addSeries,
      remove: chartMock.remove,
      timeScale: () => ({ fitContent: chartMock.fitContent }),
    })),
    createSeriesMarkers: createSeriesMarkersMock.mockReturnValue({
      setMarkers: chartMock.setMarkers,
      detach: vi.fn(),
    }),
    AreaSeries: "AreaSeries",
    ColorType: { Solid: "Solid" },
    CrosshairMode: { Normal: 0 },
    LineType: { Curved: 2 },
    PriceScaleMode: { Normal: 0 },
  };
});

vi.mock("@/lib/api/client", () => ({
  apiRequest: vi.fn(),
}));

// lightweight-config imports lightweight-charts at module level — stub it
vi.mock("@/lib/chart/lightweight-config", () => ({
  baseChartOptions: {},
  areaSeriesOptions: {},
  CHART_THEME: { background: "transparent" },
}));

const mockedApiRequest = vi.mocked(apiRequest);

// ── fixtures ───────────────────────────────────────────────────────────────
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

function mockSuccess(history: AssetHistoryPoint[] = HISTORY, markers: AssetMarkerPoint[] = MARKERS) {
  mockedApiRequest.mockImplementation(async (url: string) => {
    if (String(url).includes("/markers")) return markers;
    return history;
  });
}

// ── tests ──────────────────────────────────────────────────────────────────
describe("AssetChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chartMock.addSeries.mockReturnValue(chartMock);
    createSeriesMarkersMock.mockReturnValue({
      setMarkers: chartMock.setMarkers,
      detach: vi.fn(),
    });
  });

  it("shows loading skeleton while fetching", () => {
    mockedApiRequest.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<AssetChart symbol="HYPE" range="ALL" />);

    // loading state renders an animated div, no error/empty text
    expect(screen.queryByText(/historial/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sin datos/i)).not.toBeInTheDocument();
  });

  it("shows error message when API fails", async () => {
    mockedApiRequest.mockRejectedValue(new Error("500 Server Error"));
    render(<AssetChart symbol="HYPE" range="ALL" />);

    await waitFor(() => {
      expect(screen.getByText("No fue posible cargar el historial de precio.")).toBeInTheDocument();
    });
  });

  it("shows empty state when history array is empty", async () => {
    mockedApiRequest.mockResolvedValue([]);
    render(<AssetChart symbol="HYPE" range="ALL" />);

    await waitFor(() => {
      expect(screen.getByText("Sin datos históricos disponibles.")).toBeInTheDocument();
    });
  });

  it("feeds flat history array directly to chart series", async () => {
    mockSuccess();
    render(<AssetChart symbol="HYPE" range="ALL" />);

    await waitFor(() => {
      expect(chartMock.setData).toHaveBeenCalledWith(
        HISTORY.map((p) => ({ time: p.time, value: p.value })),
      );
    });
  });

  it("preserves exact time/value from backend without rounding", async () => {
    const precise: AssetHistoryPoint[] = [
      { time: 1771455644, value: 28.580001 },
      { time: 1779224441, value: 47.923456 },
    ];
    mockSuccess(precise);
    render(<AssetChart symbol="HYPE" range="ALL" />);

    await waitFor(() => {
      expect(chartMock.setData).toHaveBeenCalledWith(
        precise.map((p) => ({ time: p.time, value: p.value })),
      );
    });
  });

  it("passes pre-formatted markers directly to lightweight-charts without re-mapping", async () => {
    mockSuccess();
    render(<AssetChart symbol="HYPE" range="ALL" />);

    await waitFor(() => {
      expect(chartMock.setMarkers).toHaveBeenCalledWith(
        MARKERS.map((m) => ({ ...m, time: m.time })),
      );
    });
  });

  it("clears markers when backend returns empty markers array", async () => {
    mockSuccess(HISTORY, []);
    render(<AssetChart symbol="HYPE" range="ALL" />);

    await waitFor(() => {
      expect(chartMock.setMarkers).toHaveBeenCalledWith([]);
    });
  });

  it("calls history and markers endpoints with correct symbol", async () => {
    mockSuccess();
    render(<AssetChart symbol="ETH" range="7d" />);

    await waitFor(() => expect(mockedApiRequest).toHaveBeenCalledTimes(2));

    const calls = mockedApiRequest.mock.calls.map((c) => c[0] as string);
    expect(calls.some((u) => u.includes("/ETH/") && u.includes("range=7d") && u.includes("/history"))).toBe(true);
    expect(calls.some((u) => u.includes("/ETH/") && u.includes("range=7d") && u.includes("/markers"))).toBe(true);
  });

  it("works for stock symbol (AAPL)", async () => {
    const stockHistory: AssetHistoryPoint[] = [
      { time: 1771455644, value: 192.35 },
      { time: 1771542044, value: 194.10 },
    ];
    mockSuccess(stockHistory, []);
    render(<AssetChart symbol="AAPL" range="30d" />);

    await waitFor(() => {
      expect(chartMock.setData).toHaveBeenCalledWith(
        stockHistory.map((p) => ({ time: p.time, value: p.value })),
      );
    });
  });

  it("updates chart data when range prop changes", async () => {
    const history90: AssetHistoryPoint[] = [{ time: 1775000000, value: 45.0 }];
    const history7: AssetHistoryPoint[] = [{ time: 1779000000, value: 48.5 }];

    mockedApiRequest.mockImplementation(async (url: string) => {
      if (String(url).includes("/markers")) return [];
      if (String(url).includes("range=7d")) return history7;
      return history90;
    });

    const { rerender } = render(<AssetChart symbol="HYPE" range="90d" />);

    await waitFor(() => {
      expect(chartMock.setData).toHaveBeenCalledWith(
        history90.map((p) => ({ time: p.time, value: p.value })),
      );
    });

    rerender(<AssetChart symbol="HYPE" range="7d" />);

    await waitFor(() => {
      expect(chartMock.setData).toHaveBeenLastCalledWith(
        history7.map((p) => ({ time: p.time, value: p.value })),
      );
    });
  });
});
