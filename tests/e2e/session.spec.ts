import { test, expect } from "@playwright/test";
import { expectSessionCleared, loginAs, mockBackendAPIs } from "./helpers";
import { skipUnlessXsMobile } from "./project-guards";

const ACCESS_TOKEN_KEY = "cpm.accessToken";

test.describe("Session Management", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessXsMobile(testInfo);
    await mockBackendAPIs(page);

    await page.route("/api/auth/logout", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      }),
    );
  });

  // ─── 1. RELOAD ────────────────────────────────────────────────────────────
  test("reload conserva la sesión cuando el token existe en sessionStorage", async ({ page }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/portfolio/, { timeout: 10_000 });

    const token = await page.evaluate((key) => sessionStorage.getItem(key), ACCESS_TOKEN_KEY);
    expect(token, "Access token should survive a page reload").not.toBeNull();
  });

  // ─── 2. RUTA PROTEGIDA SIN SESIÓN ─────────────────────────────────────────
  test("ruta protegida redirige a /login si no hay sesión activa", async ({ page }) => {
    await page.goto("/portfolio");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  // ─── 3. 401 NO RECUPERABLE PURGA ESTADO ───────────────────────────────────
  test("401 no recuperable purga sessionStorage y redirige a /login", async ({ page }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });

    await page.route(/\/api\/v1\/me\/portfolio/, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Token expired" }),
      }),
    );

    await page.reload();

    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expectSessionCleared(page);
  });

  // ─── 4. LOGOUT LIMPIA ESTADO ──────────────────────────────────────────────
  test("logout redirige a /login y elimina el token de sessionStorage", async ({ page }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });

    await page.getByTestId("mobile-menu-btn").click();
    const logoutBtn = page.getByTestId("logout-button");
    await logoutBtn.waitFor({ state: "visible", timeout: 5_000 });
    await logoutBtn.click();

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await expectSessionCleared(page);
  });

  // ─── 5. TOKEN ELIMINADO ENTRE NAVEGACIONES ────────────────────────────────
  test("token eliminado entre navegaciones redirige a /login", async ({ page }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });

    await page.evaluate((key) => sessionStorage.removeItem(key), ACCESS_TOKEN_KEY);
    await page.goto("/transactions");

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await expectSessionCleared(page);
  });

  // ─── 6. BACK-BUTTON POST-LOGOUT ───────────────────────────────────────────
  test("back-button post-logout no expone página protegida", async ({ page }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });

    await page.getByTestId("nav-transactions").click();
    await expect(page).toHaveURL(/\/transactions/, { timeout: 10_000 });

    await page.getByTestId("mobile-menu-btn").click();
    const logoutBtn = page.getByTestId("logout-button");
    await logoutBtn.waitFor({ state: "visible", timeout: 5_000 });
    await logoutBtn.click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    await page.goBack();

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
