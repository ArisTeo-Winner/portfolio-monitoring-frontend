import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke test configuration — targets a REAL deployed environment.
 *
 * Usage:
 *   PLAYWRIGHT_BASE_URL=https://cpm-frontend.onrender.com npm run test:e2e:smoke
 *
 * No webServer is started — the runner expects the app to be already live.
 * PLAYWRIGHT_BASE_URL MUST be set; if omitted it defaults to localhost:3000.
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://localhost:3000";

if (process.env.CI && !process.env.PLAYWRIGHT_BASE_URL) {
  throw new Error(
    "PLAYWRIGHT_BASE_URL must be set in CI when running smoke tests.\n" +
      "Example: PLAYWRIGHT_BASE_URL=https://cpm-frontend.onrender.com",
  );
}

// When VERCEL_AUTOMATION_BYPASS_SECRET is set, Playwright automatically adds the
// bypass header to BrowserContext requests. However, the standalone `request` fixture
// (APIRequestContext) is separate from BrowserContext and does NOT receive the header
// automatically. Explicitly setting extraHTTPHeaders here covers both contexts so that
// request.get() calls in smoke tests also bypass Vercel Deployment Protection.
const vercelBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const extraHTTPHeaders: Record<string, string> = vercelBypass
  ? { "x-vercel-protection-bypass": vercelBypass }
  : {};

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/smoke.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // One retry covers transient network blips in Render cold-start scenarios.
  retries: process.env.CI ? 1 : 0,
  workers: 2,

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  use: {
    baseURL,
    extraHTTPHeaders,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    locale: "es-MX",
    // Smoke tests are lightweight — 30 s is generous enough for cold-starts.
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Primary mobile target (matches fintech density policy)
    {
      name: "smoke-mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 812 },
      },
    },
    // Desktop sanity check
    {
      name: "smoke-desktop",
      use: {
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
  // No webServer block — smoke tests hit an already-running deployed instance.
});
