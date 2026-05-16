import { test, expect } from "@playwright/test";
import { loginAs, mockBackendAPIs, openLoginDialog } from "./helpers";

// Cross-breakpoint visual regression for the three main user flows.
// Settings pages are covered separately by settings-visual.spec.ts.
//
// Each Playwright project (xs-mobile, sm-large-mobile, md-tablet,
// lg-small-desktop, xl-desktop) runs these tests once at its configured
// viewport.  The project name is embedded in the snapshot name so baselines
// are stored independently per breakpoint.
//
// To regenerate baselines after an intentional UI change:
//   npx playwright test tests/e2e/visual-regression.spec.ts --update-snapshots
// Then commit the updated *-<platform>.png files and note them in the PR.

test.describe("Visual regression — Login", () => {
  test.setTimeout(60_000);

  test("Login: screenshot en todos los breakpoints", async ({ page }, testInfo) => {
    await openLoginDialog(page);
    await expect(page.getByTestId("email-input")).toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot(`login-${testInfo.project.name}.png`, {
      maxDiffPixels: 150,
    });
  });
});

test.describe("Visual regression — Portfolio", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await mockBackendAPIs(page);
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
  });

  test("Portfolio: screenshot en todos los breakpoints", async ({ page }, testInfo) => {
    await expect(page.getByTestId("portfolio-assets")).toBeVisible({ timeout: 10_000 });

    await expect(page).toHaveScreenshot(`portfolio-${testInfo.project.name}.png`, {
      maxDiffPixels: 150,
    });
  });

  test("Portfolio vacío: screenshot en todos los breakpoints", async ({ page }, testInfo) => {
    // Navigate fresh with empty portfolio override
    await page.route(/\/api\/v1\/me\/portfolio/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    );

    await page.goto("/portfolio");
    await expect(page.getByText(/no tienes activos registrados/i)).toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot(`portfolio-empty-${testInfo.project.name}.png`, {
      maxDiffPixels: 150,
    });
  });

  test("Portfolio error API: screenshot en todos los breakpoints", async ({ page }, testInfo) => {
    await page.route(/\/api\/v1\/me\/portfolio/, (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Internal Server Error" }),
      }),
    );

    await page.goto("/portfolio");
    await expect(page.getByText(/no fue posible cargar el dashboard/i)).toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot(`portfolio-error-${testInfo.project.name}.png`, {
      maxDiffPixels: 150,
    });
  });
});

test.describe("Visual regression — Transactions", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ page }) => {
    await mockBackendAPIs(page);
    await loginAs(page);
    await page.goto("/transactions");
    // Wait for page render (mobile: transactions-list; desktop: page URL settled)
    await expect(page).toHaveURL(/\/transactions/);
    await page.waitForLoadState("networkidle");
  });

  test("Transactions: screenshot en todos los breakpoints", async ({ page }, testInfo) => {
    await expect(page).toHaveScreenshot(`transactions-${testInfo.project.name}.png`, {
      maxDiffPixels: 150,
    });
  });

  test("Transactions vacías: screenshot en todos los breakpoints", async ({ page }, testInfo) => {
    await page.route(/\/api\/v1\/me\/transactions/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    );

    await page.goto("/transactions");
    await expect(page.getByText(/no tienes transacciones registradas/i)).toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot(`transactions-empty-${testInfo.project.name}.png`, {
      maxDiffPixels: 150,
    });
  });
});
