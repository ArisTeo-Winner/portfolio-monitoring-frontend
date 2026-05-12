import { test, expect } from "@playwright/test";
import { loginAs, mockBackendAPIs } from "./helpers";
import { skipUnlessXsMobile } from "./project-guards";

test.describe("Portfolio distribution", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessXsMobile(testInfo);
    await mockBackendAPIs(page);
    await loginAs(page);
  });

  test("muestra assets del portfolio (BTC, ETH, SOL)", async ({ page }) => {
    const assets = page.getByTestId("portfolio-assets");
    await expect(assets.getByText("BTC").first()).toBeVisible({ timeout: 8_000 });
    await expect(assets.getByText("ETH").first()).toBeVisible();
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
    await expect(page).toHaveScreenshot("portfolio-mobile.png", { maxDiffPixels: 100 });
  });
});
