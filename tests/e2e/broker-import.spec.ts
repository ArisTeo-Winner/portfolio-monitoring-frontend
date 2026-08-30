import path from "node:path";
import { test, expect, type Route } from "@playwright/test";
import { loginAs, mockBackendAPIs } from "./helpers";
import { skipUnlessXsMobile } from "./project-guards";

const SAMPLE_PDF = path.join(__dirname, "..", "fixtures", "sample-statement.pdf");

const JOB_ID = "job-1";

function baseJob(overrides: Record<string, unknown> = {}) {
  return {
    jobId: JOB_ID,
    fileName: "sample-statement.pdf",
    jobType: "GBM_MONTHLY_STATEMENT",
    status: "QUEUED",
    result: null,
    errorMessage: null,
    attemptCount: 0,
    createdAt: "2026-08-22T10:00:00Z",
    completedAt: null,
    ...overrides,
  };
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

/** Handles the shared list/poll/retry job endpoints, delegating each phase. */
function routeJobEndpoints(
  page: import("@playwright/test").Page,
  poll: () => unknown,
  onRetry?: () => unknown,
) {
  return page.route(/\/api\/v1\/me\/broker\/gbm\/import-jobs/, (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (method === "GET" && url.endsWith("/import-jobs")) return json(route, []); // no history on mount
    if (method === "POST" && /\/retry$/.test(url)) return json(route, onRetry?.() ?? baseJob());
    if (method === "GET" && /\/import-jobs\/[^/]+$/.test(url)) return json(route, poll());
    return route.continue();
  });
}

test.describe("Broker import (GBM) — dual-channel async job flow", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessXsMobile(testInfo);
    await mockBackendAPIs(page);
    await loginAs(page);
  });

  test("MXN channel: statement upload → polling → shows N transacciones importadas", async ({ page }) => {
    let pollCount = 0;

    // Channel 1 returns a *single* job object, not an array.
    await page.route(/\/api\/v1\/me\/broker\/gbm\/statements$/, (route) =>
      json(route, baseJob({ status: "QUEUED" }), 202),
    );
    await routeJobEndpoints(page, () => {
      pollCount += 1;
      if (pollCount === 1) return baseJob({ status: "PROCESSING" });
      return baseJob({
        status: "COMPLETED",
        completedAt: "2026-08-22T10:01:00Z",
        result: { fileName: "sample-statement.pdf", accepted: 2, duplicate: 1, skipped: 0, rejected: 0, messages: [] },
      });
    });

    await page.goto("/settings/connections");
    await expect(page.getByTestId("gbm-import-panel")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("gbm-channel-statement-input").setInputFiles(SAMPLE_PDF);

    const card = page.getByTestId("import-job-card");
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("import-job-accepted")).toHaveText(/2 transacciones importadas/, {
      timeout: 15_000,
    });
    await expect(card).toHaveAttribute("data-status", "COMPLETED");
  });

  test("USD channel: DriveWealth DEAD_LETTER muestra el error y permite reintentar hasta completar", async ({ page }) => {
    let retried = false;

    // Channel 2 accepts multiple files and returns an *array* of jobs.
    await page.route(/\/api\/v1\/me\/broker\/gbm\/drivewealth-confirmations$/, (route) =>
      json(route, [baseJob({ status: "QUEUED", jobType: "DRIVEWEALTH_CONFIRMATION" })], 202),
    );
    await routeJobEndpoints(
      page,
      () =>
        retried
          ? baseJob({
              status: "COMPLETED",
              result: { fileName: "sample-statement.pdf", accepted: 1, duplicate: 0, skipped: 0, rejected: 0, messages: [] },
            })
          : baseJob({ status: "DEAD_LETTER", errorMessage: "Formato de PDF no reconocido." }),
      () => {
        retried = true;
        return baseJob({ status: "QUEUED", attemptCount: 1 });
      },
    );

    await page.goto("/settings/connections");
    await expect(page.getByTestId("gbm-import-panel")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("gbm-channel-drivewealth-input").setInputFiles([SAMPLE_PDF]);

    await expect(page.getByTestId("import-job-error")).toHaveText(/Formato de PDF no reconocido\./, {
      timeout: 15_000,
    });

    await page.getByTestId("import-job-retry").click();

    await expect(page.getByTestId("import-job-accepted")).toHaveText(/1 transacción importada/, {
      timeout: 15_000,
    });
  });

  test("Revisar importadas: lista las transacciones de la carga y permite eliminarlas", async ({ page }) => {
    const completedJob = baseJob({
      jobId: "job-review",
      fileName: "DW-confirm.pdf",
      jobType: "DRIVEWEALTH_CONFIRMATION",
      status: "COMPLETED",
      completedAt: "2026-08-22T10:00:30Z",
      result: { fileName: "DW-confirm.pdf", accepted: 2, duplicate: 0, skipped: 0, rejected: 0, messages: [] },
    });

    const txns = [
      { transactionId: "t1", assetSymbol: "AAPL", assetType: "STOCK", transactionType: "BUY", quantity: 1.5, pricePerUnit: 200, totalValue: 300, transactionDate: "2026-08-19T00:00:00Z", fee: 0, createdAt: "2026-08-22T10:00:10Z", updatedAt: "2026-08-22T10:00:10Z", broker: "DriveWealth", currency: "USD" },
      { transactionId: "t2", assetSymbol: "NVDA", assetType: "STOCK", transactionType: "SELL", quantity: 0.5, pricePerUnit: 178, totalValue: 89, transactionDate: "2026-08-19T00:00:00Z", fee: 0, createdAt: "2026-08-22T10:00:12Z", updatedAt: "2026-08-22T10:00:12Z", broker: "DriveWealth", currency: "USD" },
    ];

    await page.route(/\/api\/v1\/me\/broker\/gbm\/import-jobs$/, (route) => json(route, [completedJob]));
    // DELETE of a specific transaction — matched before the list route below.
    await page.route(/\/api\/v1\/me\/transactions\/[^/?]+$/, (route) => {
      if (route.request().method() === "DELETE") return route.fulfill({ status: 204, body: "" });
      return route.continue();
    });
    await page.route(/\/api\/v1\/me\/transactions(\?|$)/, (route) => json(route, txns));

    await page.goto("/settings/connections");
    await expect(page.getByTestId("gbm-import-panel")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("import-job-review-toggle").click();
    await expect(page.getByTestId("import-review-row")).toHaveCount(2, { timeout: 15_000 });

    // Confirm-first delete: first click reveals confirm, second executes.
    await page.getByTestId("import-review-delete").first().click();
    await page.getByTestId("import-review-confirm-yes").click();

    await expect(page.getByTestId("import-review-row")).toHaveCount(1, { timeout: 15_000 });
  });
});
