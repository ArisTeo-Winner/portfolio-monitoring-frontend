import { test, expect } from "@playwright/test";
import { loginAs, mockBackendAPIs } from "./helpers";
import { skipUnlessMobile } from "./project-guards";

test.describe("UX States – Empty & Error", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({}, testInfo) => {
    skipUnlessMobile(testInfo);
  });

  // ─── 1. PORTFOLIO VACÍO ───────────────────────────────────────────────────
  test("portfolio vacío muestra estado empty controlado", async ({ page }) => {
    await mockBackendAPIs(page);

    // Override after mockBackendAPIs so this handler runs first (LIFO)
    await page.route(/\/api\/v1\/me\/portfolio/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    );

    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });

    await expect(
      page.getByText(/no tienes activos registrados/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ─── 2. PORTFOLIO – FALLO DE API (5xx) ───────────────────────────────────
  test("fallo de API en portfolio muestra estado de error controlado", async ({ page }) => {
    await mockBackendAPIs(page);

    await page.route(/\/api\/v1\/me\/portfolio/, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Internal Server Error" }),
      }),
    );

    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });

    await expect(
      page.getByText(/no fue posible cargar el dashboard/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ─── 3. PORTFOLIO – 403 ACCESO DENEGADO ──────────────────────────────────
  test("403 en portfolio muestra mensaje de acceso denegado controlado", async ({ page }) => {
    await mockBackendAPIs(page);

    await page.route(/\/api\/v1\/me\/portfolio/, (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Forbidden" }),
      }),
    );

    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });

    // PortfolioErrorState renders with the ApiError message from client.ts 403 handler
    await expect(
      page.getByText(/you do not have permission to perform this action/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ─── 4. TRANSACCIONES VACÍAS ──────────────────────────────────────────────
  test("transacciones vacías muestra estado empty controlado", async ({ page }) => {
    await mockBackendAPIs(page);

    await page.route(/\/api\/v1\/me\/transactions/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    );

    await loginAs(page);
    await page.getByTestId("nav-transactions").click();
    await expect(page).toHaveURL(/\/transactions/, { timeout: 10_000 });

    await expect(
      page.getByText(/no tienes transacciones registradas/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ─── 5. TRANSACCIONES – FALLO DE API (5xx) ───────────────────────────────
  test("fallo de API en transacciones muestra estado empty como fallback controlado", async ({ page }) => {
    await mockBackendAPIs(page);

    // TransactionsTable catch block: setTransactions([]) on error → empty state
    await page.route(/\/api\/v1\/me\/transactions/, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Internal Server Error" }),
      }),
    );

    await loginAs(page);
    await page.getByTestId("nav-transactions").click();
    await expect(page).toHaveURL(/\/transactions/, { timeout: 10_000 });

    await expect(
      page.getByText(/no tienes transacciones registradas/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ─── 6. PORTFOLIO – ERROR DE RED ─────────────────────────────────────────
  test("network error en portfolio muestra estado de error controlado", async ({ page }) => {
    await mockBackendAPIs(page);

    // Abort the portfolio request to simulate a network-level failure
    await page.route(/\/api\/v1\/me\/portfolio/, (route) => route.abort("failed"));

    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });

    // PortfolioErrorState should appear instead of crashing the page
    await expect(
      page.getByText(/no fue posible cargar el dashboard/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ─── 7. TRANSACCIONES – ERROR DE RED ─────────────────────────────────────
  test("network error en transacciones no crashea la página", async ({ page }) => {
    await mockBackendAPIs(page);

    await page.route(/\/api\/v1\/me\/transactions/, (route) => route.abort("failed"));

    await loginAs(page);
    await page.getByTestId("nav-transactions").click();
    await expect(page).toHaveURL(/\/transactions/, { timeout: 10_000 });

    // The transactions component falls back to empty state on error
    await expect(
      page.getByText(/no tienes transacciones registradas/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ─── 8. TRANSACCIONES – 403 ACCESO DENEGADO ──────────────────────────────
  test("403 en transacciones no crashea la página y no muestra stack trace", async ({ page }) => {
    await mockBackendAPIs(page);

    await page.route(/\/api\/v1\/me\/transactions/, (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Forbidden" }),
      }),
    );

    await loginAs(page);
    await page.getByTestId("nav-transactions").click();
    await expect(page).toHaveURL(/\/transactions/, { timeout: 10_000 });

    // No Java stack trace visible
    await expect(page.getByText(/at com\./i)).not.toBeVisible({ timeout: 3_000 });
    await expect(page.getByText(/NullPointerException/i)).not.toBeVisible();

    // TransactionsTable catch block falls back to empty state on 403 (setTransactions([]))
    await expect(
      page.getByText(/no tienes transacciones registradas/i),
    ).toBeVisible({ timeout: 5_000 });
  });
});
