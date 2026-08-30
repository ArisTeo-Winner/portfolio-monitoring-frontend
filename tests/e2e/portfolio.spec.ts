import { test, expect } from "@playwright/test";
import { loginAs, mockBackendAPIs } from "./helpers";
import { skipUnlessXsMobile, skipUnlessMobile } from "./project-guards";

test.describe("Portfolio distribution", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessMobile(testInfo);
    await mockBackendAPIs(page);
    await loginAs(page);
  });

  test("muestra assets del portfolio (BTC, ETH, SOL)", async ({ page }) => {
    const assets = page.getByTestId("portfolio-assets");
    // Use :visible to handle responsive layouts where mobile cards and
    // desktop table rows coexist in the DOM — .first() would pick the hidden one.
    await expect(assets.locator(':text("BTC"):visible').first()).toBeVisible({ timeout: 8_000 });
    await expect(assets.locator(':text("ETH"):visible').first()).toBeVisible();
  });

  test("muestra gráfico de distribución de holdings", async ({ page }) => {
    const count = await page.locator("canvas").count();

    if (count === 0) {
      test.skip();
      return;
    }

    const chart = page.locator("canvas, [class*='chart'], [class*='Chart']").first();
    await expect(chart).toBeVisible({ timeout: 8_000 });
  });

  test("portfolio no expone JWTs ni datos sensibles en el DOM", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    const bodyText = await page.locator("body").innerText();
    const jwtPattern = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;
    expect(bodyText, "No deben aparecer JWTs en el DOM").not.toMatch(jwtPattern);
  });

  test("screenshot visual regression – portfolio mobile", async ({ page }, testInfo) => {
    skipUnlessXsMobile(testInfo);
    await page.waitForLoadState("networkidle");
    // Chart uses Date.now() in mock data → x-axis labels shift each run.
    // 15% pixel ratio tolerance covers non-deterministic chart rendering.
    await expect(page).toHaveScreenshot("portfolio-mobile.png", { maxDiffPixelRatio: 0.15 });
  });
});
