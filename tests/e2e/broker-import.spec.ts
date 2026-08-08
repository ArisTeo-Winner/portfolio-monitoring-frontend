import path from "node:path";
import { test, expect } from "@playwright/test";
import { loginAs, mockBackendAPIs } from "./helpers";
import { skipUnlessXsMobile } from "./project-guards";

const SAMPLE_PDF = path.join(__dirname, "..", "fixtures", "sample-statement.pdf");

const PREVIEW_RESPONSE = {
  previewId: "preview-1",
  docType: "DRIVEWEALTH_CONFIRMATION",
  rows: [
    { rowId: "r1", assetSymbol: "AAPL", assetType: "STOCK", quantity: 1, pricePerUnit: 100, transactionDate: "2026-01-01", status: "NEW" },
    { rowId: "r2", assetSymbol: "MSFT", assetType: "STOCK", quantity: 2, pricePerUnit: 200, transactionDate: "2026-01-02", status: "DUPLICATE", statusReason: "Ya existe" },
    { rowId: "r3", assetSymbol: "TSLA", assetType: "STOCK", quantity: 3, pricePerUnit: 300, transactionDate: "2026-01-03", status: "ERROR", statusReason: "Precio inválido" },
  ],
};

test.describe("Broker import (GBM)", () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessXsMobile(testInfo);
    await mockBackendAPIs(page);
    await loginAs(page);
  });

  test("DriveWealth: preview muestra la tabla y confirmar importa las filas NEW seleccionadas", async ({ page }) => {
    await page.route(/\/api\/v1\/me\/import\/preview/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PREVIEW_RESPONSE) }),
    );

    await page.goto("/settings/connections");
    await expect(page.getByTestId("gbm-import-panel")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("gbm-drivewealth-confirmation-input").setInputFiles([SAMPLE_PDF, SAMPLE_PDF]);

    await expect(page.getByTestId("import-preview-table")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("import-summary")).toHaveText("1 nueva, 1 duplicada, 1 error");

    const rows = page.getByTestId("import-preview-row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1).getByTestId("import-row-checkbox")).toBeDisabled();
    await expect(rows.nth(2).getByTestId("import-row-checkbox")).toBeDisabled();

    await page.route(/\/api\/v1\/me\/import\/confirm/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ importedCount: 1 }) }),
    );

    await page.getByTestId("gbm-drivewealth-confirmation-confirm").click();

    await expect(page.getByTestId("gbm-drivewealth-confirmation-success")).toHaveText(
      "1 transacciones importadas correctamente.",
    );
  });

  test("Estado de Cuenta Mensual: backend 501 muestra el panel Próximamente", async ({ page }) => {
    await page.route(/\/api\/v1\/me\/import\/preview/, (route) =>
      route.fulfill({
        status: 501,
        contentType: "application/json",
        body: JSON.stringify({ title: "Not Implemented", status: 501 }),
      }),
    );

    await page.goto("/settings/connections");
    await expect(page.getByTestId("gbm-import-panel")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("gbm-monthly-statement-input").setInputFiles(SAMPLE_PDF);

    await expect(page.getByTestId("gbm-import-coming-soon")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("import-preview-table")).toHaveCount(0);
  });

  test("PDF escaneado: backend 422 SCANNED_PDF muestra el mensaje específico", async ({ page }) => {
    await page.route(/\/api\/v1\/me\/import\/preview/, (route) =>
      route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ title: "Unprocessable Entity", status: 422, errorCode: "SCANNED_PDF" }),
      }),
    );

    await page.goto("/settings/connections");
    await expect(page.getByTestId("gbm-import-panel")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("gbm-drivewealth-confirmation-input").setInputFiles(SAMPLE_PDF);

    await expect(page.getByText("PDF escaneado, súbelo en texto o regístralo manual.")).toBeVisible({
      timeout: 10_000,
    });
  });
});
