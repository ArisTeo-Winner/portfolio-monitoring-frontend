import { test, expect, type Page } from "@playwright/test";
import { loginAs, mockBackendAPIs, openLoginDialog } from "./helpers";
import { skipUnlessMobile } from "./project-guards";

// These errors are expected in a mocked test environment without a real backend.
// They do NOT represent application bugs.
const BENIGN_PATTERNS: RegExp[] = [
  /net::ERR_/,              // network unavailability (backend not running in mocked E2E)
  /Failed to fetch/,         // same
  /NetworkError/,            // same
  /Failed to load resource/, // browser logs HTTP 4xx/5xx responses as console.error
  /favicon/,                 // favicon 404 in test environments
  /actuator\/health/,        // upstream health probe timeout from BFF /api/health
];

function isBenign(text: string): boolean {
  return BENIGN_PATTERNS.some((r) => r.test(text));
}

function collectErrors(page: Page): string[] {
  const buf: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !isBenign(msg.text())) {
      buf.push(msg.text());
    }
  });
  page.on("pageerror", (err) => buf.push(`[pageerror] ${err.message}`));
  return buf;
}

function assertClean(errors: string[], context: string) {
  expect(
    errors,
    `Unexpected console.error en "${context}":\n${errors.join("\n")}`,
  ).toHaveLength(0);
}

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

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Console errors — flujos críticos", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({}, testInfo) => {
    skipUnlessMobile(testInfo);
  });

  // ── 1. LOGIN ──────────────────────────────────────────────────────────────

  test("login: sin console.error al cargar la página", async ({ page }) => {
    const errors = collectErrors(page);
    await openLoginDialog(page);
    await expect(page.getByTestId("email-input")).toBeVisible({ timeout: 8_000 });
    await page.waitForLoadState("networkidle");
    assertClean(errors, "/login — page load");
  });

  test("login: sin console.error al interactuar con el formulario", async ({ page }) => {
    // Route to a controlled error so the form processes the response without crashing
    await page.route(/\/api\/v1\/auth\/login/, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Credenciales incorrectas" }),
      }),
    );

    const errors = collectErrors(page);
    await openLoginDialog(page);
    await page.getByTestId("email-input").locator("input").fill("user@test.com");
    await page.getByTestId("password-input").locator("input").fill("WrongPass1!");
    await page.getByTestId("submit-login").click();
    await expect(page.getByText(/credenciales incorrectas/i)).toBeVisible({ timeout: 8_000 });
    assertClean(errors, "/login — form interaction + error response");
  });

  // ── 2. PORTFOLIO ──────────────────────────────────────────────────────────

  test("portfolio: sin console.error durante carga exitosa", async ({ page }) => {
    const errors = collectErrors(page);
    await mockBackendAPIs(page);
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    assertClean(errors, "/portfolio — load");
  });

  test("portfolio: sin console.error después de reload", async ({ page }) => {
    await mockBackendAPIs(page);
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });

    // Start collecting AFTER the initial load to isolate the reload cycle
    const errors = collectErrors(page);
    await page.reload();
    await page.waitForLoadState("networkidle");
    assertClean(errors, "/portfolio — reload");
  });

  // ── 3. TRANSACTIONS ───────────────────────────────────────────────────────

  test("transactions: sin console.error durante navegación y carga", async ({ page }) => {
    const errors = collectErrors(page);
    await mockBackendAPIs(page);
    await loginAs(page);
    await page.getByTestId("nav-transactions").click();
    await expect(page).toHaveURL(/\/transactions/, { timeout: 10_000 });
    await page.waitForLoadState("networkidle");
    assertClean(errors, "/transactions — navigation + load");
  });

  // ── 4. SETTINGS ───────────────────────────────────────────────────────────

  test("settings/account: sin console.error durante carga", async ({ page }) => {
    const errors = collectErrors(page);
    await mockSettingsAPIs(page);
    await mockBackendAPIs(page);
    await loginAs(page);
    await page.goto("/settings/account");
    await expect(page.getByTestId("account-settings-form")).toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");
    assertClean(errors, "/settings/account — load");
  });

  test("settings: sin console.error al navegar entre sub-rutas", async ({ page }) => {
    const errors = collectErrors(page);
    await mockSettingsAPIs(page);
    await mockBackendAPIs(page);
    await loginAs(page);

    for (const [path, testid] of [
      ["/settings/account", "account-settings-form"],
      ["/settings/security", "security-settings-form"],
      ["/settings/preferences", "preferences-settings-form"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByTestId(testid)).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState("networkidle");
    }

    assertClean(errors, "settings sub-route navigation");
  });
});
