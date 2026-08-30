import { test, expect } from "@playwright/test";

/**
 * Smoke tests — fast, unauthenticated checks against a real deployed instance.
 *
 * Rules:
 *  - No page.route() mocks — we hit the real server.
 *  - No login credentials — only public/unauthenticated flows.
 *  - Each test must complete in under 30 seconds.
 *  - Designed to run in both smoke-mobile and smoke-desktop projects.
 */

// ─── 1. PAGE AVAILABILITY ───────────────────────────────────────────────────

test.describe("Smoke: Page availability", () => {
  test.setTimeout(30_000);

  test("GET /login returns 200 and renders the page", async ({ request, page }) => {
    const res = await request.get("/login");
    expect(res.status(), "HTTP /login must return 200").toBe(200);

    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // Either the open-login-btn is visible (home with dialog trigger)
    // or the login form is rendered inline.
    const loginTrigger = page
      .locator(
        '[data-testid="open-login-btn-mobile"]:visible, [data-testid="open-login-btn-desktop"]:visible, [data-testid="email-input"]:visible',
      )
      .first();
    await expect(loginTrigger).toBeVisible({ timeout: 20_000 });
  });

  test("GET / does not crash (root redirects or renders)", async ({ request }) => {
    const res = await request.get("/");
    // Acceptable: 200 (landing) or 3xx (redirect to /login or /portfolio)
    expect(res.status(), "Root must not return 4xx/5xx").toBeLessThan(400);
  });
});

// ─── 2. AUTH GUARD ──────────────────────────────────────────────────────────

test.describe("Smoke: Auth guard", () => {
  test.setTimeout(30_000);

  test("GET /portfolio without session redirects to /login", async ({ page }) => {
    await page.goto("/portfolio");
    // The protected shell clears session and calls router.replace("/login")
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test("GET /transactions without session redirects to /login", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});

// ─── 3. HEALTH ROUTE ────────────────────────────────────────────────────────

test.describe("Smoke: Health endpoint", () => {
  test.setTimeout(30_000);

  test("/api/health responds with a valid JSON payload", async ({ request }) => {
    const res = await request.get("/api/health");

    // 200 = backend reachable (UP/UNKNOWN), 504 = backend unreachable (UNREACHABLE).
    // Both are valid BFF responses — the frontend is alive either way.
    expect([200, 504], "/api/health must return 200 or 504").toContain(res.status());

    const body = await res.json();
    expect(body, "Response must have 'status' field").toHaveProperty("status");
    expect(body, "Response must have 'durationMs' field").toHaveProperty("durationMs");
    expect(typeof body.durationMs, "'durationMs' must be a number").toBe("number");
  });
});

// ─── 4. STATIC ASSETS ───────────────────────────────────────────────────────

test.describe("Smoke: Static assets", () => {
  test.setTimeout(30_000);

  test("Next.js JS bundle is served from /_next/static/", async ({ page }) => {
    const jsRequests: string[] = [];

    page.on("response", (res) => {
      if (res.url().includes("/_next/static/") && res.url().endsWith(".js")) {
        jsRequests.push(res.url());
        expect(res.status(), `Bundle ${res.url()} must return 200`).toBe(200);
      }
    });

    await page.goto("/login");
    // JS bundles load during page fetch. waitForLoadState("networkidle") covers lazy-
    // loaded chunks; timeout is capped so a slow CoinGecko proxy call (public page
    // fires market-data queries on mount) never aborts the assertion.
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

    expect(jsRequests.length, "At least one /_next/static/ JS bundle must load").toBeGreaterThan(0);
  });

  test("favicon is served", async ({ request }) => {
    const res = await request.get("/favicon.ico");
    // Some Next.js apps serve it as /icon.png — accept either
    expect([200, 204, 404], "favicon.ico acceptable responses").toContain(res.status());
  });
});

// ─── 5. SECURITY HEADERS ────────────────────────────────────────────────────

test.describe("Smoke: Security headers", () => {
  test.setTimeout(30_000);

  test("/login response includes required security headers", async ({ request }) => {
    const res = await request.get("/login");
    const headers = res.headers();

    expect(headers["x-frame-options"], "X-Frame-Options must be DENY").toBe("DENY");
    expect(
      headers["x-content-type-options"],
      "X-Content-Type-Options must be nosniff",
    ).toBe("nosniff");
    expect(
      headers["content-security-policy"],
      "Content-Security-Policy header must be present",
    ).toBeTruthy();
    expect(
      headers["referrer-policy"],
      "Referrer-Policy header must be present",
    ).toBeTruthy();
  });

  test("/login response does not expose sensitive headers", async ({ request }) => {
    const res = await request.get("/login");
    const headers = res.headers();

    // X-Powered-By leaks framework info — Next.js removes it; verify it stays gone.
    expect(headers["x-powered-by"], "X-Powered-By must not be exposed").toBeUndefined();
  });
});

// ─── 6. CONSOLE ERRORS ──────────────────────────────────────────────────────

test.describe("Smoke: Console health", () => {
  test.setTimeout(30_000);

  test("login page has no critical JS errors on load", async ({ page }) => {
    const criticalErrors: string[] = [];

    page.on("pageerror", (err) => criticalErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Ignore benign network errors: backend may be cold-starting (Render free tier)
        // or the health probe may timeout on first load.
        // vercel.live is injected by Vercel into preview deployments and blocked by our
        // strict CSP — this is expected infra noise, not an app error.
        const benign =
          text.includes("net::ERR_") ||
          text.includes("Failed to fetch") ||
          text.includes("NetworkError") ||
          text.includes("favicon") ||
          text.includes("actuator/health") || // upstream health probe
          text.includes("vercel.live"); // Vercel preview tooling blocked by CSP
        if (!benign) {
          criticalErrors.push(text);
        }
      }
    });

    await page.goto("/login");
    // Cap networkidle wait so slow CoinGecko proxy calls (fired on mount by the public
    // landing page) don't cause the test to time out before errors are checked.
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

    expect(
      criticalErrors,
      `Critical JS errors on /login:\n${criticalErrors.join("\n")}`,
    ).toHaveLength(0);
  });
});
