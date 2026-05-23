import { defineConfig } from "@playwright/test";

/**
 * Responsive layout config — density + overflow checks on all 5 breakpoints.
 *
 * Usage:
 *   npm run test:e2e:responsive
 *   npx playwright test --config playwright.responsive.config.ts
 *
 * Runs:
 *   - settings-responsive-density.spec.ts  (Fintech Density rules at each viewport)
 *   - responsive-overflow.spec.ts          (overflow + bottom-nav visibility)
 *
 * Bottom-nav visibility contract (matches lg:hidden Tailwind class):
 *   xs-mobile (375)      → visible
 *   sm-large-mobile (640)→ visible
 *   md-tablet (768)      → visible
 *   lg-small-desktop (1024) → hidden  ← lg:hidden kicks in here
 *   xl-desktop (1280)    → hidden
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "**/settings-responsive-density.spec.ts",
    "**/responsive-overflow.spec.ts",
  ],

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report-responsive", open: "never" }],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    locale: "es-MX",
  },

  projects: [
    {
      name: "xs-mobile",
      use: { viewport: { width: 375, height: 812 } },
    },
    {
      name: "sm-large-mobile",
      use: { viewport: { width: 640, height: 900 } },
    },
    {
      name: "md-tablet",
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: "lg-small-desktop",
      use: { viewport: { width: 1024, height: 768 } },
    },
    {
      name: "xl-desktop",
      use: { viewport: { width: 1280, height: 900 } },
    },
  ],

  webServer:
    process.env.PLAYWRIGHT_BASE_URL
      ? undefined
      : {
          command: "npm run dev",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
});
