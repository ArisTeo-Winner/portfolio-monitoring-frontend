import { defineConfig, devices } from "@playwright/test";

/**
 * Fintech Density viewport standard — mobile-first at 375×812.
 * Row height max: 40px | Paddings: py-1/py-2 | Typography: text-sm / text-[10px]
 *
 * ─── Suite topology ──────────────────────────────────────────────────────────
 *
 *  npx playwright test  (this config)
 *  └── xs-mobile        : full functional E2E suite (auth, session, portfolio,
 *                         transactions, security, ux-states, …)
 *  └── sm / md / lg / xl: responsive-only specs
 *                         (settings-responsive-density + responsive-overflow)
 *
 *  Excluded from the normal run (use dedicated commands below):
 *    accessibility.spec.ts   → npm run test:e2e:a11y
 *    settings-visual.spec.ts → npm run test:e2e:visual
 *    visual-regression.spec.ts → npm run test:e2e:visual
 *    smoke.spec.ts           → npm run test:e2e:smoke
 *
 * ─── Dedicated commands ──────────────────────────────────────────────────────
 *   npm run test:e2e            — quality-gate run (functional + responsive)
 *   npm run test:e2e:xs         — xs-mobile functional only
 *   npm run test:e2e:responsive — responsive density + overflow, all 5 projects
 *   npm run test:e2e:a11y       — accessibility audit (axe-core), xs-mobile
 *   npm run test:e2e:visual     — visual regression + settings-visual, all 5
 *   npm run test:e2e:smoke      — smoke against deployed URL
 */

const MOBILE_VIEWPORT = { width: 375, height: 812 };

/**
 * Specs that must NEVER run as part of the normal quality-gate.
 * They are tested in their own dedicated pipelines / commands.
 */
const EXCLUDED_FROM_NORMAL_RUN = [
  "**/accessibility.spec.ts",
  "**/settings-visual.spec.ts",
  "**/visual-regression.spec.ts",
  "**/smoke.spec.ts",
];

/**
 * The only specs that sm / md / lg / xl projects run in the normal gate.
 * Functional specs (auth, session, portfolio, …) use xs-mobile guards
 * internally, but restricting testMatch here avoids loading them at all,
 * which keeps the run fast and avoids noisy skips in the report.
 */
const RESPONSIVE_ONLY_SPECS = [
  "**/settings-responsive-density.spec.ts",
  "**/responsive-overflow.spec.ts",
];

export default defineConfig({
  testDir: "./tests/e2e",

  // Exclude visual, a11y and smoke from every project in this config.
  testIgnore: EXCLUDED_FROM_NORMAL_RUN,

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Run 2 workers locally for speed; CI sets PLAYWRIGHT_WORKERS or falls back to 1.
  workers: process.env.CI ? 1 : 2,

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
    // ── xs-mobile ────────────────────────────────────────────────────────────
    // Runs the full functional + responsive suite.  All specs not in
    // EXCLUDED_FROM_NORMAL_RUN are eligible.
    {
      name: "xs-mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 812 },
      },
      // No testMatch restriction — xs-mobile runs everything allowed by testIgnore.
    },

    // ── sm / md / lg / xl ────────────────────────────────────────────────────
    // Restricted to responsive specs only. Functional specs are either
    // xs-mobile-only by internal guards or not relevant at these viewports.
    {
      name: "sm-large-mobile",
      use: {
        viewport: { width: 640, height: 900 },
      },
      testMatch: RESPONSIVE_ONLY_SPECS,
    },
    {
      name: "md-tablet",
      use: {
        viewport: { width: 768, height: 1024 },
      },
      testMatch: RESPONSIVE_ONLY_SPECS,
    },
    {
      name: "lg-small-desktop",
      use: {
        viewport: { width: 1024, height: 768 },
      },
      testMatch: RESPONSIVE_ONLY_SPECS,
    },
    {
      name: "xl-desktop",
      use: {
        viewport: { width: 1280, height: 900 },
      },
      testMatch: RESPONSIVE_ONLY_SPECS,
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
