import { defineConfig, devices } from "@playwright/test";

/**
 * Fintech Density viewport standard — mobile-first at 375×812.
 * Row height max: 40px | Paddings: py-1/py-2 | Typography: text-sm / text-[10px]
 */
const MOBILE_VIEWPORT = { width: 375, height: 812 };

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    viewport: MOBILE_VIEWPORT,
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
    {
      name: "sm-large-mobile",
      use: {
        viewport: { width: 640, height: 900 },
      },
    },
    {
      name: "md-tablet",
      use: {
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "lg-small-desktop",
      use: {
        viewport: { width: 1024, height: 768 },
      },
    },
    {
      name: "xl-desktop",
      use: {
        viewport: { width: 1280, height: 900 },
      },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
