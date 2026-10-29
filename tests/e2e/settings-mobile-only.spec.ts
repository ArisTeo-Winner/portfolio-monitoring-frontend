import { test, expect, type Page } from "@playwright/test";
import { loginAs, mockBackendAPIs } from "./helpers";

// These tests assert behaviour that is only relevant when the mobile bottom
// navigation is visible (xs-mobile project, width 375px).
// All other projects skip the entire file via test.beforeEach.

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
        {
          id: "s3",
          device: "Firefox Linux",
          ipAddress: "172.16.4.8",
          createdAt: "2026-04-21T09:45:00.000Z",
          lastActiveAt: "2026-05-04T18:20:00.000Z",
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

test.describe("Settings mobile-only (xs-mobile)", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "xs-mobile", "xs-mobile project only");
    await mockSessionsAPI(page);
    await mockSettingsAPIs(page);
    await mockBackendAPIs(page);
    await loginAs(page);
  });

  // ── Bottom nav clearance ──────────────────────────────────────────────────────

  test("Account bottom nav no tapa botones de acción", async ({ page }) => {
    await page.goto("/settings/account");
    await expect(page.getByTestId("account-settings-form")).toBeVisible({ timeout: 10_000 });

    const nav = page.getByTestId("bottom-navigation");
    const btn = page.getByTestId("settings-reset-button");

    await expect(nav).toBeVisible({ timeout: 5_000 });
    await expect(btn).toBeVisible({ timeout: 5_000 });
    await btn.scrollIntoViewIfNeeded();

    const navBox = await nav.boundingBox();
    const btnBox = await btn.boundingBox();

    expect(navBox, "bottom-navigation: boundingBox null").not.toBeNull();
    expect(btnBox, "settings-reset-button: boundingBox null").not.toBeNull();
    expect(
      btnBox!.y + btnBox!.height,
      `button bottom (${btnBox!.y + btnBox!.height}px) overlaps nav top (${navBox!.y}px)`,
    ).toBeLessThanOrEqual(navBox!.y);
  });

  test("Security bottom nav no tapa el botón Update password", async ({ page }) => {
    await page.goto("/settings/security");
    await expect(page.getByTestId("security-settings-form")).toBeVisible({ timeout: 10_000 });

    const nav = page.getByTestId("bottom-navigation");
    const btn = page.getByTestId("settings-save-button");

    await expect(nav).toBeVisible({ timeout: 5_000 });
    await expect(btn).toBeVisible({ timeout: 5_000 });
    await btn.scrollIntoViewIfNeeded();

    const navBox = await nav.boundingBox();
    const btnBox = await btn.boundingBox();

    expect(navBox, "bottom-navigation: boundingBox null").not.toBeNull();
    expect(btnBox, "settings-save-button: boundingBox null").not.toBeNull();
    expect(
      btnBox!.y + btnBox!.height,
      `button bottom (${btnBox!.y + btnBox!.height}px) overlaps nav top (${navBox!.y}px)`,
    ).toBeLessThanOrEqual(navBox!.y);
  });

  test("Preferences bottom nav no tapa botones de acción", async ({ page }) => {
    await page.goto("/settings/preferences");
    await expect(page.getByTestId("preferences-settings-form")).toBeVisible({ timeout: 10_000 });

    const nav = page.getByTestId("bottom-navigation");
    const btn = page.getByTestId("settings-reset-button");

    await expect(nav).toBeVisible({ timeout: 5_000 });
    await expect(btn).toBeVisible({ timeout: 5_000 });
    await btn.scrollIntoViewIfNeeded();

    const navBox = await nav.boundingBox();
    const btnBox = await btn.boundingBox();

    expect(navBox, "bottom-navigation: boundingBox null").not.toBeNull();
    expect(btnBox, "settings-reset-button: boundingBox null").not.toBeNull();
    expect(
      btnBox!.y + btnBox!.height,
      `button bottom (${btnBox!.y + btnBox!.height}px) overlaps nav top (${navBox!.y}px)`,
    ).toBeLessThanOrEqual(navBox!.y);
  });

  test("Sessions bottom nav no tapa la última session card visible", async ({ page }) => {
    await page.goto("/settings/sessions");
    await expect(page.getByTestId("settings-card-sessions")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("session-card").first()).toBeVisible({ timeout: 8_000 });

    const nav = page.getByTestId("bottom-navigation");
    const lastCard = page.getByTestId("session-card").last();

    await lastCard.scrollIntoViewIfNeeded();
    await expect(nav).toBeVisible({ timeout: 5_000 });
    await expect(lastCard).toBeVisible({ timeout: 5_000 });

    const navBox = await nav.boundingBox();
    const cardBox = await lastCard.boundingBox();

    expect(navBox, "bottom-navigation: boundingBox null").not.toBeNull();
    expect(cardBox, "last session-card: boundingBox null").not.toBeNull();
    expect(
      cardBox!.y + cardBox!.height,
      `card bottom (${cardBox!.y + cardBox!.height}px) overlaps nav top (${navBox!.y}px)`,
    ).toBeLessThanOrEqual(navBox!.y);
  });
});
