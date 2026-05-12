import { test, expect } from "@playwright/test";
import { openLoginDialog, mockBackendAPIs } from "./helpers";
import { skipUnlessXsMobile } from "./project-guards";

test.describe("Login flow", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessXsMobile(testInfo);
    await openLoginDialog(page);
  });

  test("muestra el formulario de login", async ({ page }) => {
    await expect(page.getByTestId("email-input")).toBeVisible();
    await expect(page.getByTestId("password-input")).toBeVisible();
    await expect(page.getByTestId("submit-login")).toBeVisible();
  });

  test("botón Acceder está deshabilitado con campos vacíos", async ({ page }) => {
    await expect(page.getByTestId("submit-login")).toBeDisabled();
  });

  test("botón Acceder se habilita al llenar email y contraseña", async ({ page }) => {
    await page.getByTestId("email-input").locator("input").fill("user@test.com");
    await page.getByTestId("password-input").locator("input").fill("Password1!");
    await expect(page.getByTestId("submit-login")).toBeEnabled();
  });

  test("muestra error de validación Zod con email inválido", async ({ page }) => {
    await page.getByTestId("email-input").locator("input").fill("no-es-un-email");
    await page.getByTestId("password-input").locator("input").fill("Password1!");
    await page.getByTestId("submit-login").click();
    await expect(page.getByText(/correo inv/i)).toBeVisible();
  });

  test("muestra error de credenciales inválidas (BFF /api/auth/login)", async ({ page }) => {
    await page.route("/api/auth/login", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Credenciales incorrectas" }),
      }),
    );

    await page.getByTestId("email-input").locator("input").fill("wrong@test.com");
    await page.getByTestId("password-input").locator("input").fill("WrongPass1!");
    await page.getByTestId("submit-login").click();

    await expect(page.getByText(/credenciales incorrectas/i)).toBeVisible();
  });

  test("redirige a /portfolio tras login exitoso", async ({ page }) => {
    await mockBackendAPIs(page);
    await page.route("/api/auth/login", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: "fake.access.token" }),
      }),
    );

    await page.getByTestId("email-input").locator("input").fill("user@test.com");
    await page.getByTestId("password-input").locator("input").fill("Password1!");
    await page.getByTestId("submit-login").click();

    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });
  });

  test("screenshot visual regression – login dialog", async ({ page }, testInfo) => {
    // Exact pixel match only makes sense at 375×812
    skipUnlessXsMobile(testInfo);

    if (!(await page.getByTestId("email-input").isVisible().catch(() => false))) {
      await page.getByTestId("open-login-btn").first().click();
      await expect(page.getByTestId("email-input")).toBeVisible({ timeout: 8_000 });
    }

    await expect(page).toHaveScreenshot("login-dialog-mobile.png", { maxDiffPixels: 50 });
  });
});
