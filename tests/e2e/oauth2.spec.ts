import { test, expect, type Page } from "@playwright/test";
import { mockBackendAPIs } from "./helpers";
import { skipUnlessMobile } from "./project-guards";

const FAKE_ACCESS_TOKEN = "eyJhbGciOiJIUzI1NiJ9.dGVzdA.dGVzdA";
const FAKE_REFRESH_TOKEN = "fake-refresh-token-for-testing";
const OAUTH_STATE_KEY = "cpm.oauth.state";

// The callback now requires a state nonce that startGoogleLogin() stores in
// sessionStorage in the same tab before redirecting. Tests that drive the
// callback URL directly must seed that nonce to simulate a legitimate flow.
async function seedOAuthState(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    try {
      window.sessionStorage.setItem(key, "e2e-oauth-state-nonce");
    } catch {
      /* sessionStorage unavailable — nothing to seed */
    }
  }, OAUTH_STATE_KEY);
}

test.describe("OAuth2 / Google Login", () => {
  test.setTimeout(30_000);

  test.beforeEach(async ({}, testInfo) => {
    skipUnlessMobile(testInfo);
  });

  // ─── 1. BOTÓN GOOGLE VISIBLE ──────────────────────────────────────────────
  test("botón de Google es visible en el diálogo de login", async ({ page }) => {
    await page.goto("/login");

    const heading = page.getByRole("heading", { name: /bienvenido/i });
    if (!(await heading.isVisible({ timeout: 1_000 }).catch(() => false))) {
      await page
        .locator('[data-testid="open-login-btn-mobile"]:visible, [data-testid="open-login-btn-desktop"]:visible')
        .first()
        .click();
    }
    await heading.waitFor({ timeout: 8_000 });

    await expect(page.getByTestId("oauth2-google-button")).toBeVisible();
  });

  // ─── 2. CALLBACK EXITOSO → /portfolio ─────────────────────────────────────
  test("callback exitoso persiste sesión y redirige a /portfolio", async ({ page }) => {
    // First callback test in the file → it pays the on-demand compile of
    // /auth/callback + /portfolio in `next dev`. Under parallel-worker CPU load
    // that first compile can take tens of seconds (the identical flow in the
    // "no queda en loop" test below passes because the routes are warm by then).
    test.setTimeout(90_000);
    await mockBackendAPIs(page);

    await page.route("/api/auth/session", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      }),
    );

    await seedOAuthState(page);

    // Warm-up: compile the heavy /portfolio route (the redirect target) once,
    // unmeasured — refresh is mocked 401 so this just bounces to /login and
    // compiles both routes. Keeps the measured redirect below off the cold path.
    await page.goto("/portfolio");
    await page.waitForURL(/\/(login|portfolio)/, { timeout: 60_000 });

    await page.goto(
      `/auth/callback#accessToken=${FAKE_ACCESS_TOKEN}&refreshToken=${FAKE_REFRESH_TOKEN}`,
    );

    await expect(page).toHaveURL(/\/portfolio/, { timeout: 30_000 });

    // Access token is memory-only — it must NOT appear in sessionStorage.
    const token = await page.evaluate(() => sessionStorage.getItem("cpm.accessToken"));
    expect(token, "Access token must not be stored in sessionStorage after OAuth2").toBeNull();
  });

  // ─── 3. ERROR CONOCIDO → MENSAJE CONTROLADO ───────────────────────────────
  test("oauth_error conocido muestra mensaje controlado en el diálogo", async ({ page }) => {
    await page.goto("/login?oauth_error=OIDC_LOGIN_FAILED");

    const heading = page.getByRole("heading", { name: /bienvenido/i });
    if (!(await heading.isVisible({ timeout: 1_000 }).catch(() => false))) {
      await page
        .locator('[data-testid="open-login-btn-mobile"]:visible, [data-testid="open-login-btn-desktop"]:visible')
        .first()
        .click();
    }
    await heading.waitFor({ timeout: 8_000 });

    await expect(
      page.getByText(/no fue posible completar el acceso con google/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ─── 4. ERROR DESCONOCIDO → MENSAJE GENÉRICO ──────────────────────────────
  test("oauth_error desconocido muestra mensaje genérico fallback", async ({ page }) => {
    await page.goto("/login?oauth_error=UNKNOWN_ERROR_CODE");

    const heading = page.getByRole("heading", { name: /bienvenido/i });
    if (!(await heading.isVisible({ timeout: 1_000 }).catch(() => false))) {
      await page
        .locator('[data-testid="open-login-btn-mobile"]:visible, [data-testid="open-login-btn-desktop"]:visible')
        .first()
        .click();
    }
    await heading.waitFor({ timeout: 8_000 });

    await expect(
      page.getByText(/no fue posible completar el acceso social/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ─── 5. ESTADO DE CARGA VISIBLE DURANTE EL CALLBACK ──────────────────────
  test("estado 'Signing you in' es visible mientras se procesa el callback", async ({ page }) => {
    // Use a promise that never resolves to keep the loading state visible
    // indefinitely so the assertion can observe it without a race condition.
    await page.route("/api/auth/session", () => new Promise(() => {}));
    await mockBackendAPIs(page);

    await seedOAuthState(page);
    void page.goto(
      `/auth/callback#accessToken=${FAKE_ACCESS_TOKEN}&refreshToken=${FAKE_REFRESH_TOKEN}`,
    );

    await expect(
      page.getByRole("heading", { name: /signing you in/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  // ─── 6. SIN LOOP INFINITO EN CALLBACK ────────────────────────────────────
  test("callback con tokens válidos no queda en loop — termina en /portfolio", async ({ page }) => {
    await mockBackendAPIs(page);

    await page.route("/api/auth/session", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      }),
    );

    await seedOAuthState(page);
    await page.goto(
      `/auth/callback#accessToken=${FAKE_ACCESS_TOKEN}&refreshToken=${FAKE_REFRESH_TOKEN}`,
    );

    await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });
    expect(page.url()).not.toMatch(/\/auth\/callback/);
  });
});
