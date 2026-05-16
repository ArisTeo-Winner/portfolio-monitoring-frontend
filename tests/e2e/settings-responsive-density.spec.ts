import { test, expect, type Browser, type Page } from "@playwright/test";
import { loginAs, mockBackendAPIs } from "./helpers";

// ─── Constants ────────────────────────────────────────────────────────────────
const CARD_HEIGHT_BY_PROJECT: Record<string, number> = {
  "xs-mobile": 900,
  "sm-large-mobile": 900,
  "md-tablet": 900,
  "lg-small-desktop": 760,
  "xl-desktop": 860,
};

const SESSION_CARD_HEIGHT_BY_PROJECT: Record<string, number> = {
  "xs-mobile": 180,
  "sm-large-mobile": 200,
  "md-tablet": 240,
};

const MIN_TOUCH_TARGET_PX = 44;
const MAX_TOUCH_TARGET_PX = 56;

// Projects whose viewport width is < 1024px — session mobile card list is visible
const MOBILE_PROJECTS: readonly string[] = ["xs-mobile", "sm-large-mobile", "md-tablet"];

// ─── Mock helpers ─────────────────────────────────────────────────────────────
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

// ─── Assertion helpers ────────────────────────────────────────────────────────
async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow, "horizontal overflow detected").toBe(false);
}

async function assertCardHeight(page: Page, testid: string, maxPx: number) {
  const card = page.getByTestId(testid);
  await expect(card).toBeVisible({ timeout: 8_000 });
  const box = await card.boundingBox();
  expect(box, `${testid}: boundingBox null`).not.toBeNull();
  expect(
    box!.height,
    `${testid}: height ${box!.height}px > ${maxPx}px`,
  ).toBeLessThanOrEqual(maxPx);
}

async function assertTouchTarget(page: Page, testid: string) {
  const el = page.getByTestId(testid).first();
  await expect(el).toBeVisible({ timeout: 5_000 });
  const box = await el.boundingBox();
  expect(box, `${testid}: boundingBox null`).not.toBeNull();
  expect(
    box!.height,
    `${testid}: height ${box!.height}px < ${MIN_TOUCH_TARGET_PX}px`,
  ).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
}

async function assertAllTouchTargets(page: Page, testid: string) {
  const controls = page.getByTestId(testid);
  const count = await controls.count();
  expect(count, `${testid}: no elements found`).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const box = await controls.nth(i).boundingBox();
    expect(box, `${testid}[${i}]: boundingBox null`).not.toBeNull();
    expect(
      box!.height,
      `${testid}[${i}]: ${box!.height}px < ${MIN_TOUCH_TARGET_PX}px`,
    ).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    expect(
      box!.height,
      `${testid}[${i}]: ${box!.height}px > ${MAX_TOUCH_TARGET_PX}px`,
    ).toBeLessThanOrEqual(MAX_TOUCH_TARGET_PX);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings responsive density
// Each project (xs-mobile, sm-large-mobile, md-tablet, lg-small-desktop,
// xl-desktop) runs these tests once at its own configured viewport.
// No BREAKPOINTS loop. No page.setViewportSize().
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Settings responsive density", () => {
  test.setTimeout(120_000);

  // Pre-warm Next.js dev-server page compilation so the first test does not
  // time out waiting for the cold bundle of /portfolio.
  // Wrapped in try/catch: Playwright invalidates the `browser` fixture during
  // project transitions with workers:1 ("Test ended") — safe to swallow because
  // the bundle is already warm from the xs-mobile project run.
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    try {
      const page = await browser.newPage();
      await page.goto("/portfolio").catch(() => {});
      await page.close();
    } catch {
      // pre-warm best-effort only
    }
  });

  test.beforeEach(async ({ page }) => {
    await mockSessionsAPI(page);
    await mockSettingsAPIs(page);
    await mockBackendAPIs(page);
    await loginAs(page);
  });

  // ── Account ──────────────────────────────────────────────────────────────────

  test("Account no tiene overflow horizontal", async ({ page }) => {
    await page.goto("/settings/account");
    await expect(page.getByTestId("account-settings-form")).toBeVisible({ timeout: 10_000 });
    await assertNoHorizontalOverflow(page);
  });

  test("Account settings-card-account height ≤ limit", async ({ page }, testInfo) => {
    await page.goto("/settings/account");
    await expect(page.getByTestId("account-settings-form")).toBeVisible({ timeout: 10_000 });
    await assertCardHeight(page, "settings-card-account", CARD_HEIGHT_BY_PROJECT[testInfo.project.name]);
  });

  test("Account inputs touch target ≥ 44px", async ({ page }) => {
    await page.goto("/settings/account");
    await expect(page.getByTestId("account-settings-form")).toBeVisible({ timeout: 10_000 });
    for (const id of ["username-input", "email-input"]) {
      await assertTouchTarget(page, id);
    }
  });

  test("Account botones de acción touch target ≥ 44px", async ({ page }) => {
    await page.goto("/settings/account");
    await expect(page.getByTestId("account-settings-form")).toBeVisible({ timeout: 10_000 });
    for (const id of ["settings-reset-button", "settings-save-button"]) {
      await assertTouchTarget(page, id);
    }
  });

  test("Account selects touch target ≥ 44px", async ({ page }) => {
    await page.goto("/settings/account");
    await expect(page.getByTestId("account-settings-form")).toBeVisible({ timeout: 10_000 });
    for (const id of ["base-currency-select", "timezone-select"]) {
      await assertTouchTarget(page, id);
    }
  });

  test("Account 4 settings-field visibles sin scroll", async ({ page }) => {
    await page.goto("/settings/account");
    await expect(page.getByTestId("account-settings-form")).toBeVisible({ timeout: 10_000 });
    const fields = page.getByTestId("settings-field");
    await expect(fields).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await expect(fields.nth(i)).toBeVisible();
    }
  });

  test("Account botones Reset y Save disabled sin cambios", async ({ page }) => {
    await page.goto("/settings/account");
    await expect(page.getByTestId("account-settings-form")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("settings-reset-button")).toBeDisabled();
    await expect(page.getByTestId("settings-save-button")).toBeDisabled();
  });

  // ── Security ─────────────────────────────────────────────────────────────────

  test("Security no tiene overflow horizontal", async ({ page }) => {
    await page.goto("/settings/security");
    await expect(page.getByTestId("security-settings-form")).toBeVisible({ timeout: 10_000 });
    await assertNoHorizontalOverflow(page);
  });

  test("Security settings-card-security height ≤ limit", async ({ page }, testInfo) => {
    await page.goto("/settings/security");
    await expect(page.getByTestId("security-settings-form")).toBeVisible({ timeout: 10_000 });
    await assertCardHeight(page, "settings-card-security", CARD_HEIGHT_BY_PROJECT[testInfo.project.name]);
  });

  test("Security inputs de contraseña touch target ≥ 44px", async ({ page }) => {
    await page.goto("/settings/security");
    await expect(page.getByTestId("security-settings-form")).toBeVisible({ timeout: 10_000 });
    for (const id of ["current-password-input", "new-password-input", "confirm-password-input"]) {
      await assertTouchTarget(page, id);
    }
  });

  test("Security botón save touch target ≥ 44px", async ({ page }) => {
    await page.goto("/settings/security");
    await expect(page.getByTestId("security-settings-form")).toBeVisible({ timeout: 10_000 });
    await assertTouchTarget(page, "settings-save-button");
  });

  test("Security 3 settings-field visibles", async ({ page }) => {
    await page.goto("/settings/security");
    await expect(page.getByTestId("security-settings-form")).toBeVisible({ timeout: 10_000 });
    const fields = page.getByTestId("settings-card-security").getByTestId("settings-field");
    await expect(fields).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(fields.nth(i)).toBeVisible();
    }
  });

  // ── Preferences ──────────────────────────────────────────────────────────────

  test("Preferences no tiene overflow horizontal", async ({ page }) => {
    await page.goto("/settings/preferences");
    await expect(page.getByTestId("preferences-settings-form")).toBeVisible({ timeout: 10_000 });
    await assertNoHorizontalOverflow(page);
  });

  test("Preferences settings-card-preferences height ≤ limit", async ({ page }, testInfo) => {
    await page.goto("/settings/preferences");
    await expect(page.getByTestId("preferences-settings-form")).toBeVisible({ timeout: 10_000 });
    await assertCardHeight(page, "settings-card-preferences", CARD_HEIGHT_BY_PROJECT[testInfo.project.name]);
  });

  test("Preferences selects touch target ≥ 44px", async ({ page }) => {
    await page.goto("/settings/preferences");
    await expect(page.getByTestId("preferences-settings-form")).toBeVisible({ timeout: 10_000 });
    for (const id of [
      "pnl-method-select",
      "default-currency-select",
      "chart-timeframe-select",
      "data-provider-select",
      "sync-frequency-select",
    ]) {
      await assertTouchTarget(page, id);
    }
  });

  test("Preferences botones de acción touch target ≥ 44px", async ({ page }) => {
    await page.goto("/settings/preferences");
    await expect(page.getByTestId("preferences-settings-form")).toBeVisible({ timeout: 10_000 });
    for (const id of ["settings-reset-button", "settings-save-button"]) {
      await assertTouchTarget(page, id);
    }
  });

  test("Preferences 6 settings-field visibles", async ({ page }) => {
    await page.goto("/settings/preferences");
    await expect(page.getByTestId("preferences-settings-form")).toBeVisible({ timeout: 10_000 });
    const fields = page.getByTestId("settings-field");
    await expect(fields).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      await expect(fields.nth(i)).toBeVisible();
    }
  });

  test("Preferences botones Reset y Save disabled sin cambios", async ({ page }) => {
    await page.goto("/settings/preferences");
    await expect(page.getByTestId("preferences-settings-form")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("settings-reset-button")).toBeDisabled();
    await expect(page.getByTestId("settings-save-button")).toBeDisabled();
  });

  // ── Sessions ─────────────────────────────────────────────────────────────────

  test("Sessions no tiene overflow horizontal", async ({ page }) => {
    await page.goto("/settings/sessions");
    await expect(page.getByTestId("settings-card-sessions")).toBeVisible({ timeout: 10_000 });
    await assertNoHorizontalOverflow(page);
  });

  test("Sessions settings-card-sessions height ≤ limit", async ({ page }, testInfo) => {
    await page.goto("/settings/sessions");
    await expect(page.getByTestId("settings-card-sessions")).toBeVisible({ timeout: 10_000 });
    await assertCardHeight(page, "settings-card-sessions", CARD_HEIGHT_BY_PROJECT[testInfo.project.name]);
  });

  test("Sessions session card height ≤ limit", async ({ page }, testInfo) => {
    test.skip(
      !MOBILE_PROJECTS.includes(testInfo.project.name),
      "Desktop project: session list renders as table, not mobile cards",
    );
    const maxH = SESSION_CARD_HEIGHT_BY_PROJECT[testInfo.project.name] ?? 180;
    await page.goto("/settings/sessions");
    await expect(page.getByTestId("session-card").first()).toBeVisible({ timeout: 10_000 });

    const cards = page.getByTestId("session-card");
    const count = await cards.count();
    expect(count, "session cards rendered").toBeGreaterThanOrEqual(1);

    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box, `session-card[${i}]: boundingBox null`).not.toBeNull();
      expect(
        box!.height,
        `session-card[${i}]: height ${box!.height}px > ${maxH}px`,
      ).toBeLessThanOrEqual(maxH);
    }
  });

  test("Sessions session revoke touch target ≥ 44px", async ({ page }, testInfo) => {
    test.skip(
      !MOBILE_PROJECTS.includes(testInfo.project.name),
      "Desktop project: revoke button is in table row, not mobile card",
    );
    await page.goto("/settings/sessions");
    await expect(page.getByTestId("session-card").first()).toBeVisible({ timeout: 10_000 });

    const buttons = page.getByTestId("session-revoke-button");
    const count = await buttons.count();
    expect(count, "session-revoke-button: no buttons found").toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box, `session-revoke-button[${i}]: boundingBox null`).not.toBeNull();
      expect(
        box!.height,
        `session-revoke-button[${i}]: height ${box!.height}px < ${MIN_TOUCH_TARGET_PX}px`,
      ).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    }
  });

  test("Sessions controles entre 44px y 56px", async ({ page }, testInfo) => {
    test.skip(
      !["xs-mobile", "sm-large-mobile"].includes(testInfo.project.name),
      "Category select is hidden at md+ breakpoint",
    );
    await page.goto("/settings/sessions");
    await expect(page.getByTestId("settings-card-sessions")).toBeVisible({ timeout: 10_000 });
    await assertAllTouchTargets(page, "settings-category-select");
  });
});
