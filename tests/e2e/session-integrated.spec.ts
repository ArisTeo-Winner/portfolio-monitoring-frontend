import { test, expect } from "@playwright/test";
import { openLoginDialog } from "./helpers";

/**
 * INTEGRATED session-recovery test — NO page.route mocks.
 *
 * Exercises the real BFF ↔ Spring Boot backend flow: a real login (which sets
 * the first-party `cpm.rt` HttpOnly cookie), then a browser reload, which must
 * recover the session silently via `/api/auth/refresh` (BFF → backend). This is
 * the flow the mocked suite CANNOT reproduce, and the one that regressed.
 *
 * Skipped unless E2E_EMAIL / E2E_PASSWORD are set, so it never runs in the
 * normal mocked gate. Credentials come from the environment — never hardcode
 * them. Run it yourself (PowerShell):
 *
 *   $env:E2E_EMAIL="you@example.com"; $env:E2E_PASSWORD="********"
 *   npx playwright test tests/e2e/session-integrated.spec.ts --project=xs-mobile
 */
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe("Session recovery on reload (integrated · real backend)", () => {
  test.skip(!EMAIL || !PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD to run this integrated test.");
  test.setTimeout(90_000);

  test("reload keeps the session (BFF cpm.rt → backend refresh)", async ({ page }) => {
    if (!EMAIL || !PASSWORD) return; // guarded by describe.skip; also narrows types

    await openLoginDialog(page);
    await page.getByTestId("email-input").locator("input").fill(EMAIL);
    await page.getByTestId("password-input").locator("input").fill(PASSWORD);
    await page.getByTestId("submit-login").click();

    await expect(page).toHaveURL(/\/portfolio/, { timeout: 60_000 });

    // The in-memory access token is lost on reload; the session must be
    // recovered via the HttpOnly `cpm.rt` cookie + the BFF refresh route.
    await page.reload();

    await expect(page, "reload must NOT bounce back to /login").toHaveURL(/\/portfolio/, {
      timeout: 30_000,
    });

    // Access token must stay memory-only (never persisted to sessionStorage).
    const token = await page.evaluate(() => sessionStorage.getItem("cpm.accessToken"));
    expect(token, "access token must not be persisted to sessionStorage").toBeNull();
  });
});
