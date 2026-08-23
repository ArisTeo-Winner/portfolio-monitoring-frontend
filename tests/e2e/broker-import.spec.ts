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

test.describe("Broker import (GBM) — async job flow", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessXsMobile(testInfo);
    await mockBackendAPIs(page);
    await loginAs(page);
  });

  test("upload → polling → shows N transacciones importadas", async ({ page }) => {
    let pollCount = 0;

    await page.route(/\/api\/v1\/me\/broker\/gbm\/import/, (route) => {
      const req = route.request();
      const url = req.url();
      const method = req.method();

      if (method === "POST" && url.endsWith("/import")) {
        return json(route, [baseJob({ status: "QUEUED" })], 202);
      }
      if (method === "GET" && url.endsWith("/import-jobs")) {
        return json(route, []); // no history on mount
      }
      if (method === "GET" && /\/import-jobs\/[^/]+$/.test(url)) {
        pollCount += 1;
        if (pollCount === 1) return json(route, baseJob({ status: "PROCESSING" }));
        return json(
          route,
          baseJob({
            status: "COMPLETED",
            completedAt: "2026-08-22T10:01:00Z",
            result: { fileName: "sample-statement.pdf", accepted: 2, duplicate: 1, skipped: 0, rejected: 0, messages: [] },
          }),
        );
      }
      return route.continue();
    });

    await page.goto("/settings/connections");
    await expect(page.getByTestId("gbm-import-panel")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("gbm-import-input").setInputFiles(SAMPLE_PDF);

    const card = page.getByTestId("import-job-card");
    await expect(card).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId("import-job-accepted")).toHaveText(/2 transacciones importadas/, {
      timeout: 15_000,
    });
    await expect(card).toHaveAttribute("data-status", "COMPLETED");
  });

  test("DEAD_LETTER muestra el error y permite reintentar hasta completar", async ({ page }) => {
    let retried = false;

    await page.route(/\/api\/v1\/me\/broker\/gbm\/import/, (route) => {
      const req = route.request();
      const url = req.url();
      const method = req.method();

      if (method === "POST" && url.endsWith("/import")) {
        return json(route, [baseJob({ status: "QUEUED" })], 202);
      }
      if (method === "GET" && url.endsWith("/import-jobs")) {
        return json(route, []);
      }
      if (method === "POST" && /\/retry$/.test(url)) {
        retried = true;
        return json(route, baseJob({ status: "QUEUED", attemptCount: 1 }));
      }
      if (method === "GET" && /\/import-jobs\/[^/]+$/.test(url)) {
        if (!retried) {
          return json(route, baseJob({ status: "DEAD_LETTER", errorMessage: "Formato de PDF no reconocido." }));
        }
        return json(
          route,
          baseJob({
            status: "COMPLETED",
            result: { fileName: "sample-statement.pdf", accepted: 1, duplicate: 0, skipped: 0, rejected: 0, messages: [] },
          }),
        );
      }
      return route.continue();
    });

    await page.goto("/settings/connections");
    await expect(page.getByTestId("gbm-import-panel")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("gbm-import-input").setInputFiles(SAMPLE_PDF);

    await expect(page.getByTestId("import-job-error")).toHaveText(/Formato de PDF no reconocido\./, {
      timeout: 15_000,
    });

    await page.getByTestId("import-job-retry").click();

    await expect(page.getByTestId("import-job-accepted")).toHaveText(/1 transacción importada/, {
      timeout: 15_000,
    });
  });
});
