import { defineConfig } from "@playwright/test";

/**
 * Visual regression config — screenshots + settings visual.
 *
 * Usage:
 *   npm run test:e2e:visual
 *   npx playwright test --config playwright.visual.config.ts
 *
 * To update baselines (only when a UI change is intentional and reviewed):
 *   npx playwright test --config playwright.visual.config.ts --update-snapshots
 *
 * Runs visual-regression.spec.ts and settings-visual.spec.ts on all 5 projects.
 * Never auto-updates snapshots — require explicit --update-snapshots flag.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "**/visual-regression.spec.ts",
    "**/settings-visual.spec.ts",
  ],

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries for visual tests — flaky retries can corrupt baselines.
  retries: 0,
  workers: process.env.CI ? 1 : 2,

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report-visual", open: "never" }],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    screenshot: "on",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    locale: "es-MX",
    // Do NOT pass --update-snapshots by default; reviewers must opt in.
    ignoreHTTPSErrors: false,
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
