import { defineConfig, devices } from "@playwright/test";

/**
 * Accessibility audit config — axe-core via @axe-core/playwright.
 *
 * Usage:
 *   npm run test:e2e:a11y
 *   npx playwright test --config playwright.a11y.config.ts
 *
 * Runs only accessibility.spec.ts on xs-mobile (375×812).
 * Kept separate from the quality-gate run because axe audits are slow
 * (~5-6 min) and should not block fast PR feedback.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["**/accessibility.spec.ts"],

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report-a11y", open: "never" }],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 375, height: 812 },
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    locale: "es-MX",
  },

  projects: [
    {
      name: "xs-mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 812 },
      },
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
