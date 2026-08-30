import { expect, type Page } from "@playwright/test";

/**
 * Verify no access token was persisted to sessionStorage.
 * Access token must live ONLY in Zustand memory (CLAUDE.md §6).
 * sessionStorage should always be empty; this assertion makes the
 * security contract explicit in test output.
 */
export async function expectSessionCleared(page: Page) {
  const storageSnapshot = await page.evaluate(() => JSON.stringify(sessionStorage));
  expect(
    storageSnapshot,
    "sessionStorage must never contain any token data",
  ).not.toMatch(/token|jwt|eyJ/i);
}

const FAKE_ACCESS_TOKEN = "eyJhbGciOiJSUzI1NiJ9.dGVzdA.dGVzdA";

export async function openLoginDialog(page: Page) {
  await page.goto("/login");
  const heading = page.getByRole("heading", { name: /bienvenido/i });

  if (!(await heading.isVisible({ timeout: 1_000 }).catch(() => false))) {
    // Mobile and desktop each render their own trigger (only one is ever
    // display:block at a given viewport) — match whichever is visible.
    await page
      .locator('[data-testid="open-login-btn-mobile"]:visible, [data-testid="open-login-btn-desktop"]:visible')
      .first()
      .click();
  }

  // 30s to accommodate Vite cold-compile on first navigation in a fresh run
  await heading.waitFor({ timeout: 30_000 });
  await expect(page.getByTestId("email-input")).toBeVisible({ timeout: 30_000 });
}

export async function loginAs(page: Page) {
  // Mock the backend login endpoint (called directly by login.ts — no BFF proxy).
  // Pattern matches http://localhost:8080/api/v1/auth/login
  await page.route(/\/api\/v1\/auth\/login/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accessToken: FAKE_ACCESS_TOKEN }),
    }),
  );

  // Also mock the refresh endpoint so the protected-shell bootstrap
  // (triggered on /portfolio load) resolves immediately without a real backend.
  await page.route(/\/api\/v1\/tokens\/refresh/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accessToken: FAKE_ACCESS_TOKEN }),
    }),
  );

  await openLoginDialog(page);
  await page.getByTestId("email-input").locator("input").fill("user@test.com");
  await page.getByTestId("password-input").locator("input").fill("Password1!");
  await page.getByTestId("submit-login").click();
  await expect(page).toHaveURL(/\/portfolio/, { timeout: 60_000 });
}

export async function mockBackendAPIs(page: Page) {
  // Regex patterns para interceptar llamadas al backend (apiBaseUrl = http://localhost:8080)
  await page.route(/\/api\/v1\/me\/portfolio/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { portfolioEntryId: "pe-btc", userId: "u1", assetSymbol: "BTC", assetType: "CRYPTO", totalQuantity: "0.5", currentValue: "30000", totalInvested: "25000", totalProfitLoss: "5000", averagePricePerUnit: "50000", lastTransactionPrice: "60000", lastUpdated: "2025-01-15T10:00:00Z", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-15T10:00:00Z" },
        { portfolioEntryId: "pe-eth", userId: "u1", assetSymbol: "ETH", assetType: "CRYPTO", totalQuantity: "4", currentValue: "12000", totalInvested: "10000", totalProfitLoss: "2000", averagePricePerUnit: "2500", lastTransactionPrice: "3000", lastUpdated: "2025-01-20T14:30:00Z", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-20T14:30:00Z" },
        { portfolioEntryId: "pe-sol", userId: "u1", assetSymbol: "SOL", assetType: "CRYPTO", totalQuantity: "10", currentValue: "860", totalInvested: "1500", totalProfitLoss: "-640", averagePricePerUnit: "150", lastTransactionPrice: "86", lastUpdated: "2025-02-01T09:00:00Z", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-02-01T09:00:00Z" },
      ]),
    }),
  );

  await page.route(/\/api\/v1\/me\/transactions/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { transactionId: "tx-1", transactionType: "BUY", assetSymbol: "BTC", assetType: "CRYPTO", quantity: 0.5, pricePerUnit: 60000, totalValue: 30000, transactionDate: "2025-01-15T10:00:00Z", fee: 0, createdAt: "2025-01-15T10:00:00Z", updatedAt: "2025-01-15T10:00:00Z" },
        { transactionId: "tx-2", transactionType: "SELL", assetSymbol: "ETH", assetType: "CRYPTO", quantity: 2, pricePerUnit: 3000, totalValue: 6000, transactionDate: "2025-01-20T14:30:00Z", fee: 0, createdAt: "2025-01-20T14:30:00Z", updatedAt: "2025-01-20T14:30:00Z" },
        { transactionId: "tx-3", transactionType: "BUY", assetSymbol: "SOL", assetType: "CRYPTO", quantity: 10, pricePerUnit: 150, totalValue: 1500, transactionDate: "2025-02-01T09:00:00Z", fee: 0, createdAt: "2025-02-01T09:00:00Z", updatedAt: "2025-02-01T09:00:00Z" },
      ]),
    }),
  );

  await page.route(/\/api\/v1\/users\/me/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "u1", username: "testuser", email: "user@test.com" }),
    }),
  );

  // Asset search — powers AssetAvatar logo lookups (prefetchAssetLogos). Left
  // unmocked, this hits the real backend + a live image CDN, racing against
  // screenshot capture (fallback avatar vs loaded logo) and causing flaky
  // visual-regression diffs. Empty result keeps every avatar on the
  // deterministic fallback (initials) with no follow-up image fetch.
  await page.route(/\/api\/v1\/assets\/search/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) }),
  );

  const nowSeconds = Math.floor(Date.now() / 1_000);
  const DAY_SECONDS = 86_400;
  // NOTE: must include /me/ — endpoints.portfolio.history is "/api/v1/me/portfolio/history".
  // A regex missing that segment never matches, silently falling through to the
  // real backend for the holdings chart series (this was the case here before).
  //
  // NOTE: body must match PortfolioHistoryResponse ({ meta, series: [{ time, value }] },
  // `time` in unix SECONDS) — a bare array of { timestamp, value } (this mock's shape
  // before this fix) parses as `data.series === undefined`, so the chart silently
  // falls back to the empty state no matter what values are here.
  await page.route(/\/api\/v1\/me\/portfolio\/history/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        meta: { range: "ALL", resolution: "1d", from: nowSeconds - 6 * DAY_SECONDS, to: nowSeconds, currency: "USD", points: 7 },
        series: [
        { time: nowSeconds - 6 * DAY_SECONDS, value: 38_500 },
        { time: nowSeconds - 5 * DAY_SECONDS, value: 40_200 },
        { time: nowSeconds - 4 * DAY_SECONDS, value: 39_800 },
        { time: nowSeconds - 3 * DAY_SECONDS, value: 41_100 },
        { time: nowSeconds - 2 * DAY_SECONDS, value: 42_860 },
        { time: nowSeconds - 1 * DAY_SECONDS, value: 41_960 },
        { time: nowSeconds, value: 42_860 },
        ],
      }),
    }),
  );

  // Mock 3rd-party CoinGecko via Next.js proxy routes (CLAUDE.md: page.route para 3rd party)
  await page.route(/\/api\/coingecko/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) }),
  );

  // Silent refresh endpoint — called directly by protected-shell bootstrap and
  // client.ts retry logic. Return 401 to simulate an unauthenticated state in
  // tests that don't call loginAs first, or override per-test as needed.
  await page.route(/\/api\/v1\/tokens\/refresh/, (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ detail: "No refresh token" }),
    }),
  );

  // FX rate mock — needed by portfolio page/store (MXN→USD conversion, added in
  // 5e5f76c). Without this, loadPortfolio's Promise.all waits on the real Render
  // backend, whose cold start (30-50 s, see sessions mock below) exceeds every
  // portfolio-assets timeout and leaves the page stuck on the loading skeleton.
  await page.route(/\/api\/v1\/marketdata\/fx\/usdmxn/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ rate: 17.5, pctChange: 0.12, absChange: 0.02 }),
    }),
  );

  // Sessions mock — needed by settings/sessions page; included here so any test
  // that calls mockBackendAPIs has the route covered even if the real Render backend
  // is cold (30-50 s cold start would otherwise timeout the 10 s toBeVisible check).
  await page.route(/\/api\/v1\/me\/sessions/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "s1", device: "Chrome on Windows", ipAddress: "192.168.1.1", createdAt: "2026-05-01T10:00:00.000Z", lastActiveAt: "2026-05-06T08:15:00.000Z", current: true, location: null },
        { id: "s2", device: "Safari iPhone", ipAddress: "10.0.0.23", createdAt: "2026-04-28T14:30:00.000Z", lastActiveAt: "2026-05-05T22:10:00.000Z", current: false, location: null },
        { id: "s3", device: "Firefox Linux", ipAddress: "172.16.4.8", createdAt: "2026-04-21T09:45:00.000Z", lastActiveAt: "2026-05-04T18:20:00.000Z", current: false, location: null },
      ]),
    }),
  );
}
