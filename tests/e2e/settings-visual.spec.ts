import { test, expect, type Page } from "@playwright/test";
import { loginAs, mockBackendAPIs } from "./helpers";

// Screenshots only. Each Playwright project runs this file once at its own
// configured viewport — the project name is used to name the snapshot so
// baselines are stored separately per breakpoint.

async function mockSessionsAPI(page: Page) {
  await page.route(/\/api\/v1\/me\/sessions/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "s1",
          device: "Chrome on Windows",
          ipAddress: "192.168.1.1",
          createdAt: "2026-05-01T10:00:00.000Z",
          lastActiveAt: "2026-05-06T08:15:00.000Z",
          current: true,
          location: null,
        },
        {
          id: "s2",
          device: "Safari iPhone",
          ipAddress: "10.0.0.23",
          createdAt: "2026-04-28T14:30:00.000Z",
          lastActiveAt: "2026-05-05T22:10:00.000Z",
          current: false,
          location: null,
        },
      ]),
    }),
  );
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
}

test.describe("Settings visual regression", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await mockSessionsAPI(page);
    await mockSettingsAPIs(page);
    await mockBackendAPIs(page);
    await loginAs(page);
  });

  test("Account screenshot", async ({ page }, testInfo) => {
    await page.goto("/settings/account");
    await expect(page.getByTestId("account-settings-form")).toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot(`settings-account-${testInfo.project.name}.png`, {
      maxDiffPixels: 150,
    });
  });

  test("Security screenshot", async ({ page }, testInfo) => {
    await page.goto("/settings/security");
    await expect(page.getByTestId("security-settings-form")).toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot(`settings-security-${testInfo.project.name}.png`, {
      maxDiffPixels: 150,
    });
  });

  test("Preferences screenshot", async ({ page }, testInfo) => {
    await page.goto("/settings/preferences");
    await expect(page.getByTestId("preferences-settings-form")).toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot(`settings-preferences-${testInfo.project.name}.png`, {
      maxDiffPixels: 150,
    });
  });

  test("Sessions screenshot", async ({ page }, testInfo) => {
    await page.goto("/settings/sessions");
    await expect(page.getByTestId("settings-card-sessions")).toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot(`settings-sessions-${testInfo.project.name}.png`, {
      maxDiffPixels: 150,
    });
  });
});
