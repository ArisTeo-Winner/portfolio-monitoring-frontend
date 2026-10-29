import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loginAs, mockBackendAPIs, openLoginDialog } from "./helpers";
import { skipUnlessXsMobile } from "./project-guards";

// ─── Mock helpers (same data as density/visual specs) ─────────────────────────
async function mockSessionsAPI(page: Page) {
  await page.route(/\/api\/v1\/me\/sessions/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "s1",
          device: "Chrome on Windows",
          ipAddress: "192.168.1.1",
          createdAt: "2026-05-01T10:00:00.000Z",
          lastActiveAt: "2026-05-06T08:15:00.000Z",
          current: true,
          location: null,
        },
        {
          id: "s2",
          device: "Safari iPhone",
          ipAddress: "10.0.0.23",
          createdAt: "2026-04-28T14:30:00.000Z",
          lastActiveAt: "2026-05-05T22:10:00.000Z",
          current: false,
          location: null,
        },
      ]),
    }),
  );
}

async function mockSettingsAPIs(page: Page) {
  await page.route(/\/api\/v1\/me\/preferences/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        autoSyncEnabled: true,
        autoSyncFrequency: "1H",
        chartDefaultTimeframe: "30D",
        dataProviderPriority: "FIRST_AVAILABLE",
        defaultCurrency: "USD",
        pnlMethod: "FIFO",
      }),
    }),
  );
}

// ─── Shared setup: login + navigate to a settings sub-route ──────────────────
async function loginAndGoTo(page: Page, path: string) {
  await mockSessionsAPI(page);
  await mockSettingsAPIs(page);
  await mockBackendAPIs(page);
  await loginAs(page);
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

// ─── Axe analysis helper ─────────────────────────────────────────────────────
type AxeViolation = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"][number];

function formatViolations(violations: AxeViolation[]): string {
  return violations
    .map(
      (v) =>
        `[${v.impact ?? "?"}] ${v.id}: ${v.description}\n` +
        v.nodes
          .slice(0, 3)
          .map((n) => `  ↳ ${n.html.slice(0, 120)}`)
          .join("\n"),
    )
    .join("\n\n");
}

async function assertNoCriticalViolations(
  page: Page,
  opts: { disableRules?: string[]; excludeSelectors?: string[] } = {},
) {
  let builder = new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // Canvas elements are inherently opaque to axe — exclude to avoid false positives
    .exclude("canvas");

  for (const sel of opts.excludeSelectors ?? []) {
    builder = builder.exclude(sel);
  }
  if (opts.disableRules?.length) {
    builder = builder.disableRules(opts.disableRules);
  }

  const { violations } = await builder.analyze();

  const blocking = violations.filter((v) =>
    ["critical", "serious"].includes(v.impact ?? ""),
  );

  expect(
    blocking,
    `${blocking.length} critical/serious violation(s):\n\n${formatViolations(blocking)}`,
  ).toHaveLength(0);
}

async function analyzeRule(page: Page, rule: string): Promise<AxeViolation[]> {
  const { violations } = await new AxeBuilder({ page })
    .withRules([rule])
    .exclude("canvas")
    .analyze();
  return violations;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite — initially xs-mobile only; expand to responsive once stable.
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Accessibility – WCAG 2.1 AA (critical routes)", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({}, testInfo) => {
    skipUnlessXsMobile(testInfo);
  });

  // ── /login ──────────────────────────────────────────────────────────────────
  test.describe("/login", () => {
    test("no critical/serious axe violations", async ({ page }) => {
      await openLoginDialog(page);
      await expect(page.getByTestId("email-input")).toBeVisible({ timeout: 8_000 });
      await assertNoCriticalViolations(page);
    });

    test("inputs tienen labels asociados (rule: label)", async ({ page }) => {
      await openLoginDialog(page);
      await expect(page.getByTestId("email-input")).toBeVisible({ timeout: 8_000 });
      const violations = await analyzeRule(page, "label");
      expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test("botones tienen nombre accesible (rule: button-name)", async ({ page }) => {
      await openLoginDialog(page);
      await expect(page.getByTestId("email-input")).toBeVisible({ timeout: 8_000 });
      const violations = await analyzeRule(page, "button-name");
      expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test("contraste de texto aceptable (rule: color-contrast)", async ({ page }) => {
      await openLoginDialog(page);
      await expect(page.getByTestId("email-input")).toBeVisible({ timeout: 8_000 });
      const violations = await analyzeRule(page, "color-contrast");
      expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test("Tab navega entre campos del formulario", async ({ page }) => {
      await openLoginDialog(page);
      await expect(page.getByTestId("email-input")).toBeVisible({ timeout: 8_000 });

      // Start focus on the email input
      await page.getByTestId("email-input").locator("input").focus();
      const focused0 = await page.evaluate(() => document.activeElement?.tagName);
      expect(focused0?.toLowerCase()).toBe("input");

      // Tab should move focus to another interactive element
      await page.keyboard.press("Tab");
      const focused1 = await page.evaluate(() =>
        document.activeElement
          ? `${document.activeElement.tagName}:${document.activeElement.getAttribute("type") ?? document.activeElement.getAttribute("data-testid") ?? ""}`
          : "none",
      );
      expect(focused1, "Focus must move after Tab").not.toBe("none");
      expect(focused1, "Focus must leave the email input").not.toBe("INPUT:email");

      // Focused element must be visible
      await expect(page.locator(":focus")).toBeVisible();
    });
  });

  // ── /portfolio ──────────────────────────────────────────────────────────────
  test.describe("/portfolio", () => {
    test("no critical/serious axe violations", async ({ page }) => {
      await mockBackendAPIs(page);
      await loginAs(page);
      await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });
      await page.waitForLoadState("networkidle");
      await assertNoCriticalViolations(page);
    });

    test("botones tienen nombre accesible (rule: button-name)", async ({ page }) => {
      await mockBackendAPIs(page);
      await loginAs(page);
      await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });
      const violations = await analyzeRule(page, "button-name");
      expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test("contraste de texto aceptable (rule: color-contrast)", async ({ page }) => {
      await mockBackendAPIs(page);
      await loginAs(page);
      await expect(page).toHaveURL(/\/portfolio/, { timeout: 15_000 });
      await page.waitForLoadState("networkidle");
      const violations = await analyzeRule(page, "color-contrast");
      expect(violations, formatViolations(violations)).toHaveLength(0);
    });
  });

  // ── /transactions ───────────────────────────────────────────────────────────
  test.describe("/transactions", () => {
    test("no critical/serious axe violations", async ({ page }) => {
      await mockBackendAPIs(page);
      await loginAs(page);
      await page.getByTestId("nav-transactions").click();
      await expect(page).toHaveURL(/\/transactions/, { timeout: 10_000 });
      await page.waitForLoadState("networkidle");
      await assertNoCriticalViolations(page);
    });

    test("labels en tabla de transacciones (rule: label)", async ({ page }) => {
      await mockBackendAPIs(page);
      await loginAs(page);
      await page.getByTestId("nav-transactions").click();
      await expect(page).toHaveURL(/\/transactions/, { timeout: 10_000 });
      const violations = await analyzeRule(page, "label");
      expect(violations, formatViolations(violations)).toHaveLength(0);
    });
  });

  // ── /settings/account ───────────────────────────────────────────────────────
  test.describe("/settings/account", () => {
    test("no critical/serious axe violations", async ({ page }) => {
      await loginAndGoTo(page, "/settings/account");
      await expect(page.getByTestId("account-settings-form")).toBeVisible({ timeout: 10_000 });
      await assertNoCriticalViolations(page);
    });

    test("inputs de account tienen labels (rule: label)", async ({ page }) => {
      await loginAndGoTo(page, "/settings/account");
      await expect(page.getByTestId("account-settings-form")).toBeVisible({ timeout: 10_000 });
      const violations = await analyzeRule(page, "label");
      expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test("botones tienen nombre accesible (rule: button-name)", async ({ page }) => {
      await loginAndGoTo(page, "/settings/account");
      await expect(page.getByTestId("account-settings-form")).toBeVisible({ timeout: 10_000 });
      const violations = await analyzeRule(page, "button-name");
      expect(violations, formatViolations(violations)).toHaveLength(0);
    });
  });

  // ── /settings/preferences ───────────────────────────────────────────────────
  test.describe("/settings/preferences", () => {
    test("no critical/serious axe violations", async ({ page }) => {
      await loginAndGoTo(page, "/settings/preferences");
      await expect(page.getByTestId("preferences-settings-form")).toBeVisible({ timeout: 10_000 });
      await assertNoCriticalViolations(page);
    });

    test("selects de preferences tienen labels (rule: label)", async ({ page }) => {
      await loginAndGoTo(page, "/settings/preferences");
      await expect(page.getByTestId("preferences-settings-form")).toBeVisible({ timeout: 10_000 });
      const violations = await analyzeRule(page, "label");
      expect(violations, formatViolations(violations)).toHaveLength(0);
    });
  });

  // ── /settings/security ──────────────────────────────────────────────────────
  test.describe("/settings/security", () => {
    test("no critical/serious axe violations", async ({ page }) => {
      await loginAndGoTo(page, "/settings/security");
      await expect(page.getByTestId("security-settings-form")).toBeVisible({ timeout: 10_000 });
      await assertNoCriticalViolations(page);
    });

    test("password inputs tienen labels (rule: label)", async ({ page }) => {
      await loginAndGoTo(page, "/settings/security");
      await expect(page.getByTestId("security-settings-form")).toBeVisible({ timeout: 10_000 });
      const violations = await analyzeRule(page, "label");
      expect(violations, formatViolations(violations)).toHaveLength(0);
    });

    test("contraste aceptable en formulario de seguridad (rule: color-contrast)", async ({ page }) => {
      await loginAndGoTo(page, "/settings/security");
      await expect(page.getByTestId("security-settings-form")).toBeVisible({ timeout: 10_000 });
      const violations = await analyzeRule(page, "color-contrast");
      expect(violations, formatViolations(violations)).toHaveLength(0);
    });
  });

  // ── /settings/sessions ──────────────────────────────────────────────────────
  test.describe("/settings/sessions", () => {
    test("no critical/serious axe violations", async ({ page }) => {
      await loginAndGoTo(page, "/settings/sessions");
      await expect(page.getByTestId("settings-card-sessions")).toBeVisible({ timeout: 10_000 });
      await assertNoCriticalViolations(page);
    });

    test("botón Revoke tiene nombre accesible (rule: button-name)", async ({ page }) => {
      await loginAndGoTo(page, "/settings/sessions");
      await expect(page.getByTestId("settings-card-sessions")).toBeVisible({ timeout: 10_000 });
      const violations = await analyzeRule(page, "button-name");
      expect(violations, formatViolations(violations)).toHaveLength(0);
    });
  });
});
