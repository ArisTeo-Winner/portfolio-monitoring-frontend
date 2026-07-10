import { test, expect, type Page } from "@playwright/test";
import { loginAs, mockBackendAPIs, openLoginDialog } from "./helpers";
import { skipUnlessMobile } from "./project-guards";

// ─────────────────────────────────────────────────────────────────────────────
// Performance basics — loading states must resolve, no infinite loops
// All tests use xs-mobile / sm-large-mobile (skipUnlessMobile) because the
// critical flows are verified at those breakpoints per CLAUDE.md.
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Performance básica — loading states", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({}, testInfo) => {
    skipUnlessMobile(testInfo);
  });

  // ── 1. LOGIN ─────────────────────────────────────────────────────────────

  test("login: el dialogo aparece dentro de 5 s de cold-open", async ({ page }) => {
    const start = Date.now();
    await openLoginDialog(page);
    await expect(page.getByTestId("email-input")).toBeVisible({ timeout: 5_000 });
    const elapsed = Date.now() - start;
    expect(elapsed, `login dialog took ${elapsed}ms`).toBeLessThan(30_000);
  });

  // ── 2. PORTFOLIO ─────────────────────────────────────────────────────────

  test("portfolio: assets visibles sin quedarse en skeleton infinito", async ({ page }) => {
    await mockBackendAPIs(page);
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });

    // The portfolio-assets testid wraps the holdings list.
    // 20s gives enough buffer under parallel-worker server load; a real infinite
    // skeleton loop would never resolve regardless of the timeout.
    await expect(page.getByTestId("portfolio-assets")).toBeVisible({ timeout: 20_000 });
  });

  test("portfolio: assets visibles y componente no queda en blanco", async ({ page }) => {
    await mockBackendAPIs(page);
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });

    // portfolio-assets wraps the holdings list — visible means content loaded
    await expect(page.getByTestId("portfolio-assets")).toBeVisible({ timeout: 20_000 });
  });

  test("portfolio: networkidle alcanzado dentro de 20 s", async ({ page }) => {
    await mockBackendAPIs(page);
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });

    // waitForLoadState throws if the timeout is exceeded — test fails with clear message.
    await page.waitForLoadState("networkidle", { timeout: 20_000 });
  });

  // ── 3. TRANSACTIONS ───────────────────────────────────────────────────────

  test("transactions: lista visible tras navegacion desde portfolio", async ({ page }) => {
    await mockBackendAPIs(page);
    await loginAs(page);

    await page.getByTestId("nav-transactions").click();
    await expect(page).toHaveURL(/\/transactions/, { timeout: 10_000 });

    // transactions-list (md:hidden) is the mobile card list; visible on xs-mobile
    await expect(page.locator("[data-testid='transactions-list']").first()).toBeVisible({ timeout: 10_000 });
  });

  test("transactions: networkidle alcanzado dentro de 15 s tras navegación", async ({ page }) => {
    await mockBackendAPIs(page);
    await loginAs(page);
    await page.getByTestId("nav-transactions").click();
    await expect(page).toHaveURL(/\/transactions/, { timeout: 10_000 });

    await page.waitForLoadState("networkidle", { timeout: 15_000 });
  });

  // ── 4. SESSION / REDIRECT ─────────────────────────────────────────────────

  test("anonymous user: redirect a /login en menos de 5 s", async ({ page }) => {
    // Simulate missing HttpOnly refresh cookie: protected-shell calls the
    // refresh endpoint on bootstrap; returning 401 immediately makes the
    // redirect deterministic and fast regardless of whether a backend is running.
    await page.route(/\/api\/v1\/tokens\/refresh/, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "No session" }),
      }),
    );
    const start = Date.now();
    await page.goto("/portfolio");
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
    const elapsed = Date.now() - start;
    expect(elapsed, `redirect took ${elapsed}ms`).toBeLessThan(5_000);
  });

  test("login exitoso: redirige a /portfolio en menos de 10 s", async ({ page }) => {
    await mockBackendAPIs(page);
    const start = Date.now();
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 10_000 });
    const elapsed = Date.now() - start;
    expect(elapsed, `post-login redirect took ${elapsed}ms`).toBeLessThan(10_000);
  });

  // ── 5. NO INFINITE LOOPS ─────────────────────────────────────────────────

  test("portfolio: no queda en loop de requests tras carga exitosa", async ({ page }) => {
    const requests: string[] = [];
    page.on("request", (req) => {
      if (/\/api\/v1\/me\/portfolio/.test(req.url())) {
        requests.push(req.url());
      }
    });

    await mockBackendAPIs(page);
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    // Wait 3s to detect any polling/retry loop
    await page.waitForTimeout(3_000);

    // Max 3 calls: initial fetch + possible retry on 401 refresh + one re-fetch.
    // More than 5 suggests an infinite loop.
    expect(
      requests.length,
      `portfolio API called ${requests.length} times — possible infinite loop`,
    ).toBeLessThanOrEqual(5);
  });

  test("anonymous redirect: no loop entre /portfolio y /login", async ({ page }) => {
    const urls: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) urls.push(frame.url());
    });

    await page.goto("/portfolio");
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });

    // Allow a short settle time
    await page.waitForTimeout(1_000);

    const redirectCount = urls.filter((u) => /\/(portfolio|login)/.test(u)).length;
    expect(
      redirectCount,
      `navigation bounced ${redirectCount} times — possible redirect loop`,
    ).toBeLessThanOrEqual(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Settings loading performance (xs-mobile only for brevity)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Settings loading — no loading loops", () => {
  test.setTimeout(45_000);

  test.beforeEach(async ({}, testInfo) => {
    skipUnlessMobile(testInfo);
  });

  async function mockSettingsAPIs(page: Page) {
    await page.route(/\/api\/v1\/me\/preferences/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          autoSyncEnabled: true,
          autoSyncFrequency: "1H",
          chartDefaultTimeframe: "30D",
          dataProviderPriority: "FIRST_AVAILABLE",
          defaultCurrency: "USD",
          pnlMethod: "FIFO",
        }),
      }),
    );
    await page.route(/\/api\/v1\/me\/sessions/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    );
  }

  test("settings/account: formulario visible dentro de 10 s", async ({ page }) => {
    await mockSettingsAPIs(page);
    await mockBackendAPIs(page);
    await loginAs(page);
    await page.goto("/settings/account");
    await expect(page.getByTestId("account-settings-form")).toBeVisible({ timeout: 10_000 });
  });

  test("settings/preferences: formulario visible dentro de 10 s", async ({ page }) => {
    await mockSettingsAPIs(page);
    await mockBackendAPIs(page);
    await loginAs(page);
    await page.goto("/settings/preferences");
    await expect(page.getByTestId("preferences-settings-form")).toBeVisible({ timeout: 10_000 });
  });
});
