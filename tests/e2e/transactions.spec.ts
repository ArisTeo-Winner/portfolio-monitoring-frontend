import { test, expect } from "@playwright/test";
import { loginAs, mockBackendAPIs } from "./helpers";
import { skipUnlessXsMobile } from "./project-guards";

test.describe("Transaction History – Fintech Density check", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessXsMobile(testInfo);
    await mockBackendAPIs(page);
    await loginAs(page);
    // Bottom nav mobile usa <button> + router.push (no <a>), preserva Zustand en memoria
    await page.getByTestId("nav-transactions").click();
    await expect(page).toHaveURL(/\/transactions/, { timeout: 15_000 });
  });

  test("tabla de transacciones es visible en mobile 375×812", async ({ page }) => {
    await expect(
      page.locator("[data-testid='transactions-list']").first(),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("Fintech Density: alto de fila ≤ 60px (mobile card layout)", async ({ page }) => {
    // Mobile usa cards en lugar de <table>; las filas son MobileAssetActionRow con h-[56px]
    const rows = page.locator("[data-mobile-asset-actions='true'] > div").first();
    await rows.waitFor({ timeout: 8_000 });
    const height = await rows.evaluate((el) => el.getBoundingClientRect().height);
    expect(height, `Fila mobile excede 60px (${height}px)`).toBeLessThanOrEqual(60);
  });

  test("Fintech Density: tipografía primaria ≤ 14px", async ({ page }) => {
    const cell = page.locator("[data-mobile-asset-actions='true'] p").first();
    await cell.waitFor({ timeout: 8_000 });

    const fontSize = await cell.evaluate(
      (el) => parseFloat(window.getComputedStyle(el).fontSize),
    );
    expect(fontSize, `Font-size debe ser ≤14px, recibido ${fontSize}px`).toBeLessThanOrEqual(14);
  });

  test("screenshot visual regression – transactions mobile", async ({ page }) => {
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("transactions-mobile.png", { maxDiffPixels: 100 });
  });
});
