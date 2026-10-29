import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { getPortfolio, invalidatePortfolioCache } from "@/features/portfolio/api/get-portfolio";
import { portfolioFixtures } from "../../mocks/fixtures/portfolio";
import { useSessionStore } from "@/state/session.store";
import { ApiError } from "@/lib/api/problem-details";

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  sessionStorage.setItem("cpm.accessToken", "test-token");
  useSessionStore.setState({ accessToken: "test-token" });
  // Force cache bypass so each test gets a fresh MSW response
  invalidatePortfolioCache();
});

afterEach(() => {
  sessionStorage.removeItem("cpm.accessToken");
  useSessionStore.setState({ accessToken: null });
  invalidatePortfolioCache();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getPortfolio – happy path (MSW)", () => {
  it("returns the portfolio entries from the API", async () => {
    const result = await getPortfolio({ force: true });
    expect(result).toHaveLength(portfolioFixtures.entries.length);
    expect(result[0].assetSymbol).toBe("BTC");
    expect(result[1].assetSymbol).toBe("ETH");
  });

  it("returns numeric-looking string values untouched", async () => {
    const result = await getPortfolio({ force: true });
    expect(result[0].totalInvested).toBe("15000.00");
    expect(result[0].currentValue).toBe("17500.00");
  });

  it("returns an empty array when the portfolio is empty", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/portfolio", () => HttpResponse.json([])),
    );
    const result = await getPortfolio({ force: true });
    expect(result).toEqual([]);
  });
});

describe("getPortfolio – assetType passthrough (MSW)", () => {
  // getPortfolio ya no corrige el assetType en el cliente: devuelve exactamente
  // lo que manda el backend (la clasificación de símbolos vive server-side).
  it("returns the backend assetType unchanged", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/portfolio", () =>
        HttpResponse.json([
          { ...portfolioFixtures.entries[0], assetSymbol: "HYPE", assetType: "CRYPTO" },
        ]),
      ),
    );
    const result = await getPortfolio({ force: true });
    expect(result[0].assetType).toBe("CRYPTO");
  });
});

describe("getPortfolio – error handling (MSW)", () => {
  it("throws ApiError on a 500 server error", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/portfolio", () =>
        HttpResponse.json({ detail: "Service unavailable" }, { status: 500 }),
      ),
    );
    await expect(getPortfolio({ force: true })).rejects.toBeInstanceOf(ApiError);
  });

  it("throws ApiError(403) with the controlled access-denied message", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/portfolio", () =>
        HttpResponse.json({ detail: "Forbidden" }, { status: 403 }),
      ),
    );
    await expect(getPortfolio({ force: true })).rejects.toMatchObject({
      status: 403,
      message: "No tienes permisos para realizar esta acción.",
    });
  });

  it("throws when the network is unavailable", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/portfolio", () => HttpResponse.error()),
    );
    await expect(getPortfolio({ force: true })).rejects.toThrow();
  });
});

describe("getPortfolio – response does not expose sensitive data", () => {
  it("does not return any field named 'token', 'jwt', or 'authorization'", async () => {
    const result = await getPortfolio({ force: true });
    for (const entry of result) {
      const keys = Object.keys(entry).map((k) => k.toLowerCase());
      expect(keys).not.toContain("token");
      expect(keys).not.toContain("jwt");
      expect(keys).not.toContain("authorization");
    }
  });
});
