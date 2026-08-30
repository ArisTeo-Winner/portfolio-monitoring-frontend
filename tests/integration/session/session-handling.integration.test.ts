import { vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../../mocks/server";
import { getPortfolio, invalidatePortfolioCache } from "@/features/portfolio/api/get-portfolio";
import { portfolioFixtures } from "../../mocks/fixtures/portfolio";
import { useSessionStore } from "@/state/session.store";
import { ApiError } from "@/lib/api/problem-details";

// ── Setup ─────────────────────────────────────────────────────────────────────

// Redefine window.location before each test so expireSession() calls
// window.location.replace(...) without triggering real jsdom navigation
// (which would change window.location.pathname for subsequent tests).
const locationReplaceMock = vi.fn();

beforeEach(() => {
  sessionStorage.setItem("cpm.accessToken", "test-token");
  useSessionStore.setState({ accessToken: "test-token" });
  invalidatePortfolioCache();

  Object.defineProperty(window, "location", {
    value: {
      href: "http://localhost/portfolio",
      pathname: "/portfolio",
      origin: "http://localhost",
      replace: locationReplaceMock,
    },
    writable: true,
    configurable: true,
  });
  locationReplaceMock.mockReset();
});

afterEach(() => {
  sessionStorage.removeItem("cpm.accessToken");
  useSessionStore.setState({ accessToken: null });
  invalidatePortfolioCache();
});

// ── 401 – token refresh ───────────────────────────────────────────────────────

describe("HTTP client – 401 auto-refresh (MSW)", () => {
  it("retries the original request after a successful token refresh", async () => {
    let portfolioCallCount = 0;

    server.use(
      http.get("http://localhost:8080/api/v1/me/portfolio", () => {
        portfolioCallCount++;
        if (portfolioCallCount === 1) {
          // First call returns 401 to trigger refresh
          return HttpResponse.json({ status: 401, title: "Unauthorized" }, { status: 401 });
        }
        // Second call (after refresh) returns data
        return HttpResponse.json(portfolioFixtures.entries);
      }),
    );

    const result = await getPortfolio({ force: true });
    expect(portfolioCallCount).toBe(2);
    expect(result).toHaveLength(portfolioFixtures.entries.length);
  });

  it("stores the new access token returned by the refresh endpoint", async () => {
    const refreshedToken = "refreshed-access-token";

    server.use(
      http.get("http://localhost:8080/api/v1/me/portfolio", ({ request }) => {
        const authHeader = request.headers.get("Authorization") ?? "";
        // First call (original token) → 401. Second call (refreshed token) → 200.
        if (authHeader.includes("test-token")) {
          return HttpResponse.json({ status: 401 }, { status: 401 });
        }
        return HttpResponse.json(portfolioFixtures.entries);
      }),
      http.post("http://localhost/api/auth/refresh", () =>
        HttpResponse.json({ accessToken: refreshedToken }),
      ),
    );

    await getPortfolio({ force: true });
    expect(useSessionStore.getState().accessToken).toBe(refreshedToken);
  });

  it("clears the session and redirects when both the original request and refresh return 401", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/portfolio", () =>
        HttpResponse.json({ status: 401, title: "Unauthorized" }, { status: 401 }),
      ),
      http.post("http://localhost/api/auth/refresh", () =>
        HttpResponse.json({ status: 401 }, { status: 401 }),
      ),
    );

    // Call should ultimately reject (expireSession is called, then ApiError is thrown)
    await getPortfolio({ force: true }).catch(() => {});

    expect(useSessionStore.getState().accessToken).toBeNull();
    expect(sessionStorage.getItem("cpm.accessToken")).toBeNull();
    expect(locationReplaceMock).toHaveBeenCalledWith("/login?session_expired=1");
  });

  it("does not redirect if the pathname is already /login when the refresh fails", async () => {
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost/login",
        pathname: "/login",
        origin: "http://localhost",
        replace: locationReplaceMock,
      },
      writable: true,
      configurable: true,
    });

    server.use(
      http.get("http://localhost:8080/api/v1/me/portfolio", () =>
        HttpResponse.json({ status: 401 }, { status: 401 }),
      ),
      http.post("http://localhost/api/auth/refresh", () =>
        HttpResponse.json({ status: 401 }, { status: 401 }),
      ),
    );

    await getPortfolio({ force: true }).catch(() => {});

    // expireSession skips the replace() call when already on /login
    expect(locationReplaceMock).not.toHaveBeenCalled();
  });
});

// ── 403 – access denied ───────────────────────────────────────────────────────

describe("HTTP client – 403 handling (MSW)", () => {
  it("throws ApiError(403) with the controlled access-denied message", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/portfolio", () =>
        HttpResponse.json({ detail: "Forbidden" }, { status: 403 }),
      ),
    );
    await expect(getPortfolio({ force: true })).rejects.toMatchObject({
      status: 403,
      message: "You do not have permission to perform this action.",
    });
  });

  it("does not clear the session on a 403", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/portfolio", () =>
        HttpResponse.json({ detail: "Forbidden" }, { status: 403 }),
      ),
    );
    await getPortfolio({ force: true }).catch(() => {});

    // Session must NOT be purged on 403
    expect(useSessionStore.getState().accessToken).toBe("test-token");
    expect(locationReplaceMock).not.toHaveBeenCalled();
  });
});

// ── Network error ─────────────────────────────────────────────────────────────

describe("HTTP client – network error handling (MSW)", () => {
  it("throws (does not swallow) when the network is unavailable", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/portfolio", () => HttpResponse.error()),
    );
    await expect(getPortfolio({ force: true })).rejects.toThrow();
  });

  it("does not clear the session on a network error", async () => {
    server.use(
      http.get("http://localhost:8080/api/v1/me/portfolio", () => HttpResponse.error()),
    );
    await getPortfolio({ force: true }).catch(() => {});

    expect(useSessionStore.getState().accessToken).toBe("test-token");
    expect(locationReplaceMock).not.toHaveBeenCalled();
  });
});
