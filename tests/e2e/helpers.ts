import { expect, type Page } from "@playwright/test";

const SESSION_STORAGE_KEY = "cpm.accessToken";

export async function expectSessionCleared(page: Page) {
  const token = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    SESSION_STORAGE_KEY,
  );
  expect(token, "sessionStorage must not contain the access token after session end").toBeNull();
}

const FAKE_ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiJ9.dGVzdA.dGVzdA";

export async function openLoginDialog(page: Page) {
  await page.goto("/login");
  const heading = page.getByRole("heading", { name: /bienvenido/i });

  if (!(await heading.isVisible({ timeout: 1_000 }).catch(() => false))) {
    // Use :visible to skip CSS-hidden siblings (e.g. sm:hidden at 640px+)
    await page.locator('[data-testid="open-login-btn"]:visible').first().click();
  }

  // 30s to accommodate Vite cold-compile on first navigation in a fresh run
  await heading.waitFor({ timeout: 30_000 });
  await expect(page.getByTestId("email-input")).toBeVisible({ timeout: 30_000 });
}

export async function loginAs(page: Page) {
  await page.route("/api/auth/login", (route) =>
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

  const now = Date.now();
  await page.route(/\/api\/v1\/portfolio\/history/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { timestamp: now - 6 * 86_400_000, value: 38_500 },
        { timestamp: now - 5 * 86_400_000, value: 40_200 },
        { timestamp: now - 4 * 86_400_000, value: 39_800 },
        { timestamp: now - 3 * 86_400_000, value: 41_100 },
        { timestamp: now - 2 * 86_400_000, value: 42_860 },
        { timestamp: now - 1 * 86_400_000, value: 41_960 },
        { timestamp: now, value: 42_860 },
      ]),
    }),
  );

  // Mock 3rd-party CoinGecko via Next.js proxy routes (CLAUDE.md: page.route para 3rd party)
  await page.route(/\/api\/coingecko/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) }),
  );

  await page.route("/api/auth/refresh", (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ detail: "No refresh token" }) }),
  );
}
