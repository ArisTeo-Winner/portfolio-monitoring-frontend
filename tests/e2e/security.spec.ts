import { test, expect } from "@playwright/test";
import { loginAs, mockBackendAPIs } from "./helpers";
import { skipUnlessMobile } from "./project-guards";

// Matches any compact JWT: eyJ<header>.<payload>.<signature>
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
const ACCESS_TOKEN_KEY = "cpm.accessToken";

async function dumpLocalStorage(page: Parameters<typeof loginAs>[0]) {
  return page.evaluate(() => JSON.stringify(localStorage));
}

async function dumpSessionStorage(page: Parameters<typeof loginAs>[0]) {
  return page.evaluate(() => JSON.stringify(sessionStorage));
}

// ─── 1. TOKEN STORAGE ──────────────────────────────────────────────────────

test.describe("Security: Token Storage", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessMobile(testInfo);
    await mockBackendAPIs(page);
  });

  test("localStorage no contiene JWT ni refresh token tras login", async ({ page }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/);

    const ls = await dumpLocalStorage(page);
    expect(ls, "localStorage: no JWT").not.toMatch(JWT_PATTERN);
    expect(ls, "localStorage: no refresh key").not.toMatch(/refresh/i);
    expect(ls, "localStorage: no access_token key").not.toMatch(/access_token/i);
  });

  test("sessionStorage no contiene refresh token tras login", async ({ page }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/);

    const ssKeys: string[] = await page.evaluate(() => Object.keys(sessionStorage));
    const refreshKeys = ssKeys.filter((k) => /refresh/i.test(k));
    expect(refreshKeys, "sessionStorage: sin claves de refresh token").toHaveLength(0);
  });

  test("solo la clave cpm.accessToken es permitida en sessionStorage", async ({ page }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/);

    const ssKeys: string[] = await page.evaluate(() => Object.keys(sessionStorage));
    const unauthorized = ssKeys.filter((k) => k !== ACCESS_TOKEN_KEY);
    expect(
      unauthorized,
      `sessionStorage contiene claves no autorizadas: ${unauthorized.join(", ")}`,
    ).toHaveLength(0);
  });
});

// ─── 2. DOM EXPOSURE ───────────────────────────────────────────────────────

test.describe("Security: DOM Exposure", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessMobile(testInfo);
    await mockBackendAPIs(page);
  });

  test("DOM no contiene JWT-like values tras login y carga de portfolio", async ({ page }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/);
    await page.waitForLoadState("networkidle");

    const html = await page.content();
    expect(html, "DOM: no JWT-like values").not.toMatch(JWT_PATTERN);
  });

  test("DOM no contiene refresh_token ni access_token como strings expuestos", async ({ page }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/);
    await page.waitForLoadState("networkidle");

    const html = await page.content();
    expect(html, "DOM: no 'refresh_token'").not.toMatch(/refresh_token/i);
    // "access_token" as a key/value pair in the DOM would be a leak
    // (the sessionStorage KEY name is cpm.accessToken — not access_token)
    expect(html, "DOM: no 'access_token' string").not.toMatch(/[^a-zA-Z]access_token[^a-zA-Z]/);
  });
});

// ─── 3. CONSOLE LEAKS ──────────────────────────────────────────────────────

test.describe("Security: Console Leaks", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessMobile(testInfo);
    await mockBackendAPIs(page);
  });

  test("console no loguea Authorization headers durante sesión autenticada", async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on("console", (msg) => consoleLogs.push(msg.text()));

    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/);
    await page.waitForLoadState("networkidle");

    // Trigger a second authenticated cycle via reload
    await page.reload();
    await page.waitForLoadState("networkidle");

    const joined = consoleLogs.join("\n");
    expect(joined, "Console: no 'Authorization'").not.toMatch(/[Aa]uthorization/);
    expect(joined, "Console: no 'Bearer'").not.toMatch(/[Bb]earer/);
  });

  test("console no loguea JWT-like values durante sesión autenticada", async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on("console", (msg) => consoleLogs.push(msg.text()));

    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/);
    await page.waitForLoadState("networkidle");

    const joined = consoleLogs.join("\n");
    expect(joined, "Console: no JWT-like values").not.toMatch(JWT_PATTERN);
  });
});

// ─── 4. 401 STATE PURGE ────────────────────────────────────────────────────

test.describe("Security: 401 State Purge", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessMobile(testInfo);
    await mockBackendAPIs(page);
  });

  test("401 en API purga sessionStorage y redirige a /login sin dejar tokens", async ({
    page,
  }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/);

    // Non-recoverable 401: portfolio returns 401 and refresh also returns 401
    await page.route(/\/api\/v1\/me\/portfolio/, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Token expired" }),
      }),
    );

    await page.reload();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    const token = await page.evaluate((key) => sessionStorage.getItem(key), ACCESS_TOKEN_KEY);
    expect(token, "sessionStorage: access token eliminado tras 401").toBeNull();

    const ls = await dumpLocalStorage(page);
    expect(ls, "localStorage: sin JWT tras 401").not.toMatch(JWT_PATTERN);
  });

  test("401 no expone token ni detalle sensible en DOM post-purge", async ({ page }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/);

    await page.route(/\/api\/v1\/me\/portfolio/, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "Token expired",
          stackTrace: "java.lang.RuntimeException at AuthFilter.java:99",
        }),
      }),
    );

    await page.reload();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    const html = await page.content();
    expect(html, "DOM post-401: no JWT").not.toMatch(JWT_PATTERN);
    expect(html, "DOM post-401: no stack trace").not.toMatch(/java\.lang/);
    expect(html, "DOM post-401: no AuthFilter").not.toMatch(/AuthFilter/);
  });
});

// ─── 5. 403 CONTROLLED RESPONSE ────────────────────────────────────────────

test.describe("Security: 403 Controlled Response", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessMobile(testInfo);
    await mockBackendAPIs(page);
  });

  test("403 muestra estado controlado sin exponer stack trace del backend", async ({ page }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/);

    await page.route(/\/api\/v1\/me\/portfolio/, (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          status: 403,
          error: "Forbidden",
          trace:
            "java.lang.RuntimeException: Access denied\n\tat com.example.PortfolioService.get(PortfolioService.java:42)",
          path: "/api/v1/me/portfolio",
        }),
      }),
    );

    await page.reload();
    await page.waitForLoadState("networkidle");

    const html = await page.content();
    expect(html, "DOM: no stack trace Java").not.toMatch(/java\.lang/);
    expect(html, "DOM: no RuntimeException").not.toMatch(/RuntimeException/);
    expect(html, "DOM: no ruta interna del backend").not.toMatch(/PortfolioService\.java/);
  });

  test("403 no redirige a /login y preserva UX estable", async ({ page }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/);

    await page.route(/\/api\/v1\/me\/portfolio/, (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Access denied" }),
      }),
    );

    await page.reload();
    await page.waitForLoadState("networkidle");

    // 403 must NOT redirect to /login (only 401 causes session expiry)
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("403 no expone JWT en DOM", async ({ page }) => {
    await loginAs(page);
    await expect(page).toHaveURL(/\/portfolio/);

    await page.route(/\/api\/v1\/me\/portfolio/, (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Access denied" }),
      }),
    );

    await page.reload();
    await page.waitForLoadState("networkidle");

    const html = await page.content();
    expect(html, "DOM post-403: no JWT").not.toMatch(JWT_PATTERN);
  });
});
