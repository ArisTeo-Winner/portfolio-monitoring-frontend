import { test, expect, type Page } from "@playwright/test";
import { loginAs, mockBackendAPIs } from "./helpers";
import { skipUnlessResponsive } from "./project-guards";

const MOBILE_PROJECTS = ["xs-mobile", "sm-large-mobile", "md-tablet"] as const;

async function assertNoHorizontalOverflow(page: Page, context: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow on ${context}`).toBe(false);
}

// ─────────────────────────────────────────────────────────────────────────────
// Responsive layout — overflow & nav clearance
// All five projects run every test.  Mobile-only checks use an inline
// test.skip so the skip reason is clearly surfaced in the report.
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Responsive layout — overflow & nav clearance", () => {
  test.setTimeout(90_000);

  // ── 1. LOGIN ─────────────────────────────────────────────────────────────

  test("login: no horizontal overflow", async ({ page }, testInfo) => {
    skipUnlessResponsive(testInfo);
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await assertNoHorizontalOverflow(page, `/login at ${testInfo.project.name}`);
  });

  // ── 2. PORTFOLIO ─────────────────────────────────────────────────────────

  test("portfolio: no horizontal overflow", async ({ page }, testInfo) => {
    skipUnlessResponsive(testInfo);
    await mockBackendAPIs(page);
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });
    await page.waitForLoadState("networkidle");
    await assertNoHorizontalOverflow(page, `/portfolio at ${testInfo.project.name}`);
  });

  // ── 3. TRANSACTIONS ──────────────────────────────────────────────────────

  test("transactions: no horizontal overflow", async ({ page }, testInfo) => {
    skipUnlessResponsive(testInfo);
    await mockBackendAPIs(page);
    await loginAs(page);
    // Use goto so the test works at all breakpoints regardless of nav visibility
    await page.goto("/transactions");
    // Wait for the page to render content (either mobile list or empty state)
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/transactions/);
    await assertNoHorizontalOverflow(page, `/transactions at ${testInfo.project.name}`);
  });

  // ── 4. HEADER ────────────────────────────────────────────────────────────

  test("header: no horizontal overflow after login", async ({ page }, testInfo) => {
    skipUnlessResponsive(testInfo);
    await mockBackendAPIs(page);
    await loginAs(page);
    const headerOverflow = await page.evaluate(() => {
      const header = document.querySelector("header");
      return header ? header.scrollWidth > header.clientWidth : false;
    });
    expect(headerOverflow, `header overflows at ${testInfo.project.name}`).toBe(false);
  });

  // ── 5. BOTTOM NAV VISIBILITY ─────────────────────────────────────────────

  test("bottom nav: visible on mobile, hidden on desktop", async ({ page }, testInfo) => {
    skipUnlessResponsive(testInfo);
    await mockBackendAPIs(page);
    await loginAs(page);

    const nav = page.getByTestId("bottom-navigation");

    if ((MOBILE_PROJECTS as readonly string[]).includes(testInfo.project.name)) {
      await expect(nav).toBeVisible({ timeout: 5_000 });
    } else {
      // Tailwind lg:hidden — display:none at 1024px+
      await expect(nav).toBeHidden();
    }
  });

  // ── 6. BOTTOM NAV CLEARANCE ──────────────────────────────────────────────

  test("bottom nav: content padding clears the nav height", async ({ page }, testInfo) => {
    test.skip(
      !(MOBILE_PROJECTS as readonly string[]).includes(testInfo.project.name),
      "bottom nav clearance is only relevant on mobile breakpoints (lg:hidden)",
    );

    await mockBackendAPIs(page);
    await loginAs(page);

    // Ensure the shell is fully rendered before measuring
    const nav = page.getByTestId("bottom-navigation");
    await expect(nav).toBeVisible({ timeout: 8_000 });
    await page.waitForLoadState("networkidle");

    // Measure nav height via Playwright (more reliable than page.evaluate)
    const navBox = await nav.boundingBox();
    expect(navBox, "bottom-navigation: boundingBox null").not.toBeNull();
    const navHeight = navBox!.height;

    // Measure the content wrapper's computed paddingBottom via evaluate
    const paddingBottom = await page.evaluate(() => {
      // The content wrapper uses pb-24 (6rem = 96px) on xs/sm and md:pb-28 (7rem = 112px) on md
      const contentEl = document.querySelector<HTMLElement>("[class*='pb-24']");
      if (!contentEl) return null;
      return parseFloat(window.getComputedStyle(contentEl).paddingBottom);
    });

    expect(
      paddingBottom,
      "content wrapper with pb-24 not found — layout may have changed",
    ).not.toBeNull();

    expect(
      paddingBottom!,
      `content padding-bottom (${paddingBottom}px) < bottom nav height (${navHeight}px)`,
    ).toBeGreaterThanOrEqual(navHeight);
  });

  // ── 7. BOTTOM NAV BUTTONS ACCESSIBLE ─────────────────────────────────────

  test("bottom nav: all tab buttons are visible and tappable", async ({ page }, testInfo) => {
    test.skip(
      !(MOBILE_PROJECTS as readonly string[]).includes(testInfo.project.name),
      "bottom nav buttons only rendered at mobile breakpoints",
    );

    await mockBackendAPIs(page);
    await loginAs(page);
    await page.waitForLoadState("networkidle");

    const nav = page.getByTestId("bottom-navigation");
    await expect(nav).toBeVisible({ timeout: 5_000 });

    for (const testid of ["nav-portfolio", "nav-transactions", "nav-dashboard"]) {
      const btn = page.getByTestId(testid);
      await expect(btn).toBeVisible({ timeout: 5_000 });
      const box = await btn.boundingBox();
      expect(box, `${testid}: boundingBox null`).not.toBeNull();
      // Minimum tap target: 44px × 44px (WCAG 2.5.5)
      expect(box!.height, `${testid}: height ${box!.height}px < 44px`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${testid}: width ${box!.width}px < 44px`).toBeGreaterThanOrEqual(44);
    }
  });
});
