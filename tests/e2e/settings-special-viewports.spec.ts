import { test, expect, type Page } from "@playwright/test";
import { loginAs, mockBackendAPIs } from "./helpers";

// Tests for non-standard viewports not covered by any configured project.
// Each describe uses page.setViewportSize() intentionally and is pinned to the
// xs-mobile project so the test runs exactly once (not 5× across all projects).

const FAKE_ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiJ9.dGVzdA.dGVzdA";

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

// ─────────────────────────────────────────────────────────────────────────────
// Sessions – 720×1280 (sm-wide, between sm and md breakpoints)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Settings special viewports – Sessions 720×1280", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }, testInfo) => {
    // Pin to xs-mobile so this runs exactly once across all projects
    test.skip(testInfo.project.name !== "xs-mobile", "Special viewport: runs once under xs-mobile");
    await page.setViewportSize({ width: 720, height: 1280 });
    // Register sessions mock first so it's available when the page loads.
    await mockSessionsAPI(page);
    // Use the standard mock + login flow so all backend endpoints are covered
    // and the access token is in memory (avoids expireSession on any API 401).
    await mockBackendAPIs(page);
    await loginAs(page);
    await page.goto("/settings/sessions");
    await expect(page.getByTestId("settings-card-sessions")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("session-card").first()).toBeVisible({ timeout: 8_000 });
  });

  test("session cards stay inside the settings card", async ({ page }) => {
    const settingsCard = page.getByTestId("settings-card-sessions");
    const cards = page.getByTestId("session-card");
    const containerBox = await settingsCard.boundingBox();
    const count = await cards.count();

    expect(containerBox, "settings-card-sessions: boundingBox null").not.toBeNull();
    expect(count, "session cards rendered").toBeGreaterThanOrEqual(1);

    for (let i = 0; i < count; i++) {
      const box = await cards.nth(i).boundingBox();
      expect(box, `session-card[${i}]: boundingBox null`).not.toBeNull();
      expect(
        box!.x,
        `session-card[${i}]: left edge outside container`,
      ).toBeGreaterThanOrEqual(containerBox!.x);
      expect(
        box!.x + box!.width,
        `session-card[${i}]: right edge outside container`,
      ).toBeLessThanOrEqual(containerBox!.x + containerBox!.width);
    }
  });

  test("no horizontal overflow at 720×1280", async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow, "horizontal overflow detected at 720×1280").toBe(false);
  });
});
