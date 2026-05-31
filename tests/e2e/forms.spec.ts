import { test, expect, type Page } from "@playwright/test";
import { loginAs, mockBackendAPIs, openLoginDialog } from "./helpers";
import { skipUnlessMobile } from "./project-guards";

// Shared mock account response (matches AccountSettings type)
const MOCK_ACCOUNT = {
  id: "u1",
  username: "testuser",
  email: "user@test.com",
  baseCurrency: "USD",
  timezone: "America/Mexico_City",
};

async function mockAccountSettingsAPI(page: Page) {
  // Override the /api/v1/users/me route added by mockBackendAPIs (LIFO wins)
  await page.route(/\/api\/v1\/users\/me/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_ACCOUNT),
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Login form — disabled states, validation, loading, double-submit, error recovery
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Login form — estados y validación", () => {
  test.setTimeout(45_000);

  test.beforeEach(async ({}, testInfo) => {
    skipUnlessMobile(testInfo);
  });

  test("submit disabled con campos vacíos", async ({ page }) => {
    await openLoginDialog(page);
    await expect(page.getByTestId("submit-login")).toBeDisabled();
  });

  test("submit disabled con solo email (sin password)", async ({ page }) => {
    await openLoginDialog(page);
    await page.getByTestId("email-input").locator("input").fill("user@test.com");
    await expect(page.getByTestId("submit-login")).toBeDisabled();
  });

  test("submit disabled con solo password (sin email)", async ({ page }) => {
    await openLoginDialog(page);
    await page.getByTestId("password-input").locator("input").fill("Password1!");
    await expect(page.getByTestId("submit-login")).toBeDisabled();
  });

  test("submit habilitado con email y password válidos", async ({ page }) => {
    await openLoginDialog(page);
    await page.getByTestId("email-input").locator("input").fill("user@test.com");
    await page.getByTestId("password-input").locator("input").fill("Password1!");
    await expect(page.getByTestId("submit-login")).toBeEnabled();
  });

  test("email inválido muestra error Zod antes de llamar a la API", async ({ page }) => {
    let apiCalled = false;
    await page.route("/api/auth/login", (route) => {
      apiCalled = true;
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    });

    await openLoginDialog(page);
    await page.getByTestId("email-input").locator("input").fill("not-an-email");
    await page.getByTestId("password-input").locator("input").fill("Password1!");
    await page.getByTestId("submit-login").click();

    // Zod validation should fire client-side — API must NOT be called
    await page.waitForTimeout(500);
    expect(apiCalled, "API was called despite invalid email").toBe(false);
    // An error message related to email should appear
    await expect(page.locator("text=/email|correo/i").first()).toBeVisible({ timeout: 3_000 });
  });

  test("submit muestra 'Accediendo...' y se deshabilita durante el request", async ({ page }) => {
    await page.route(/\/api\/v1\/auth\/login/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Credenciales incorrectas" }),
      });
    });

    await openLoginDialog(page);
    await page.getByTestId("email-input").locator("input").fill("user@test.com");
    await page.getByTestId("password-input").locator("input").fill("WrongPass1!");
    await page.getByTestId("submit-login").click();

    await expect(page.getByTestId("submit-login")).toContainText("Accediendo...", { timeout: 3_000 });
    await expect(page.getByTestId("submit-login")).toBeDisabled();

    // After the response resolves the button should re-enable
    await expect(page.getByTestId("submit-login")).toBeEnabled({ timeout: 5_000 });
  });

  test("doble-submit no envía dos requests al backend", async ({ page }) => {
    let callCount = 0;
    await page.route(/\/api\/v1\/auth\/login/, async (route) => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "error" }),
      });
    });

    await openLoginDialog(page);
    await page.getByTestId("email-input").locator("input").fill("user@test.com");
    await page.getByTestId("password-input").locator("input").fill("Password1!");

    await page.getByTestId("submit-login").click();
    // Attempt a second click while the first request is still in-flight
    await page.getByTestId("submit-login").click({ force: true });

    // Wait for the first request to finish
    await expect(page.getByTestId("submit-login")).toBeEnabled({ timeout: 5_000 });
    expect(callCount, "more than one login request was sent").toBe(1);
  });

  test("error del backend se limpia al iniciar un nuevo submit", async ({ page }) => {
    let attempt = 0;
    await page.route(/\/api\/v1\/auth\/login/, (route) => {
      attempt++;
      if (attempt === 1) {
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Credenciales incorrectas" }),
        });
      }
      // Second attempt hangs long enough to observe the cleared error state
      return new Promise(() => {});
    });

    await openLoginDialog(page);
    await page.getByTestId("email-input").locator("input").fill("user@test.com");
    await page.getByTestId("password-input").locator("input").fill("WrongPass1!");
    await page.getByTestId("submit-login").click();

    await expect(page.getByText(/credenciales incorrectas/i)).toBeVisible({ timeout: 5_000 });

    // Submit again — the error message should disappear immediately (setError(null) in handleSubmit)
    await page.getByTestId("submit-login").click();
    await expect(page.getByText(/credenciales incorrectas/i)).not.toBeVisible({ timeout: 3_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Settings Account form — disabled states, field change, loading, reset
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Settings Account form — estados y validación", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({}, testInfo) => {
    skipUnlessMobile(testInfo);
  });

  async function goToAccountSettings(page: Page) {
    await mockBackendAPIs(page);
    await mockAccountSettingsAPI(page);
    await loginAs(page);
    await page.goto("/settings/account");
    await expect(page.getByTestId("account-settings-form")).toBeVisible({ timeout: 10_000 });
    // Wait for the form to finish loading initial data (buttons become disabled after reset)
    await expect(page.getByTestId("settings-save-button")).toBeDisabled({ timeout: 8_000 });
  }

  test("Save y Reset disabled cuando no hay cambios (isDirty = false)", async ({ page }) => {
    await goToAccountSettings(page);
    await expect(page.getByTestId("settings-reset-button")).toBeDisabled();
    await expect(page.getByTestId("settings-save-button")).toBeDisabled();
  });

  test("Save y Reset se habilitan tras modificar un campo", async ({ page }) => {
    await goToAccountSettings(page);

    const usernameInput = page.getByTestId("username-input").locator("input");
    await usernameInput.fill("newusername");

    await expect(page.getByTestId("settings-save-button")).toBeEnabled({ timeout: 3_000 });
    await expect(page.getByTestId("settings-reset-button")).toBeEnabled();
  });

  test("Reset restaura el valor original y deshabilita los botones", async ({ page }) => {
    await goToAccountSettings(page);

    const usernameInput = page.getByTestId("username-input").locator("input");
    const originalValue = await usernameInput.inputValue();

    await usernameInput.fill("temporaryvalue");
    await expect(page.getByTestId("settings-reset-button")).toBeEnabled({ timeout: 3_000 });

    await page.getByTestId("settings-reset-button").click();

    await expect(usernameInput).toHaveValue(originalValue, { timeout: 3_000 });
    await expect(page.getByTestId("settings-save-button")).toBeDisabled();
    await expect(page.getByTestId("settings-reset-button")).toBeDisabled();
  });

  test("Save muestra 'Guardando...' y se deshabilita durante el submit", async ({ page }) => {
    await mockBackendAPIs(page);
    await loginAs(page);

    // Add the slow PUT route AFTER mockBackendAPIs so LIFO gives it priority
    await page.route(/\/api\/v1\/users\/me/, async (route) => {
      if (route.request().method() === "PUT") {
        await new Promise((resolve) => setTimeout(resolve, 1_200));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_ACCOUNT),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ACCOUNT),
      });
    });

    await page.goto("/settings/account");
    await expect(page.getByTestId("account-settings-form")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("settings-save-button")).toBeDisabled({ timeout: 8_000 });

    await page.getByTestId("username-input").locator("input").fill("newusername");
    await expect(page.getByTestId("settings-save-button")).toBeEnabled({ timeout: 3_000 });
    await page.getByTestId("settings-save-button").click();

    await expect(page.getByTestId("settings-save-button")).toContainText("Guardando...", { timeout: 3_000 });
    await expect(page.getByTestId("settings-save-button")).toBeDisabled();
  });

  test("Save exitoso muestra mensaje de confirmación y vuelve a disabled", async ({ page }) => {
    await goToAccountSettings(page);

    await page.getByTestId("username-input").locator("input").fill("savedusername");
    await expect(page.getByTestId("settings-save-button")).toBeEnabled({ timeout: 3_000 });
    await page.getByTestId("settings-save-button").click();

    await expect(page.getByText(/configuraci[oó]n guardada/i)).toBeVisible({ timeout: 8_000 });
    // After save, the form resets isDirty = false
    await expect(page.getByTestId("settings-save-button")).toBeDisabled({ timeout: 5_000 });
  });
});
