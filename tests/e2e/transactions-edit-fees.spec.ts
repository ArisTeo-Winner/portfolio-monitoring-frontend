import { test, expect, type Route } from "@playwright/test";
import { loginAs, mockBackendAPIs } from "./helpers";

// ADR-0005 parity on EDIT: the inline transaction editor (desktop table flow)
// must expose the Comisión/IVA split like the create wizard, seed it from the
// stored FrictionBreakdown (GET /details) or decompose a flat MXN fee (fee/1.16),
// and — per the backend B2 contract — send {brokerCommission, brokerIva} WITHOUT
// `fee` only when the user edits a cost, otherwise resend the original flat fee
// so a non-cost edit never clobbers the stored split.
//
// Desktop-only feature: the inline editor lives in the `hidden md:block` <table>
// (mobile uses card rows + the modal, which has no split). The repo's harness has
// no desktop FUNCTIONAL project (xs-mobile runs the functional suite; sm/md/lg/xl
// are responsive-only), so this spec sets its own desktop viewport and runs under
// the default (xs-mobile) invocation. Its long-term CI home (a dedicated desktop
// project) is a config decision left to the team.

const CREATED = "2025-01-01T00:00:00Z";

// Two manual MXN BUYs:
//  - tx-nvda: has a stored breakdown (16.53 + 2.64) → editor seeds from /details.
//  - tx-old:  no breakdown (legacy solo-fee 23.20) → editor decomposes 20.00 + 3.20.
const LIST = JSON.stringify([
  {
    transactionId: "tx-nvda",
    transactionType: "BUY",
    assetSymbol: "NVDA",
    assetName: "NVIDIA Corporation",
    assetType: "STOCK",
    quantity: 2,
    pricePerUnit: 3307,
    totalValue: 6614,
    transactionDate: "2025-11-21T15:31:00Z",
    fee: 19.17,
    currency: "MXN",
    createdAt: CREATED,
    updatedAt: CREATED,
  },
  {
    transactionId: "tx-old",
    transactionType: "BUY",
    assetSymbol: "WALMEX",
    assetName: "Wal-Mart de México",
    assetType: "STOCK",
    quantity: 10,
    pricePerUnit: 70,
    totalValue: 700,
    transactionDate: "2025-10-01T15:00:00Z",
    fee: 23.2,
    currency: "MXN",
    createdAt: CREATED,
    updatedAt: CREATED,
  },
]);

function detailsBody(id: string) {
  if (id === "tx-nvda") {
    return {
      id: "tx-nvda",
      assetSymbol: "NVDA",
      assetType: "STOCK",
      transactionType: "BUY",
      transactionDate: "2025-11-21T15:31:00Z",
      quantity: 2,
      pricePerUnit: 3307,
      grossAmount: 6614,
      fee: 19.17,
      feeCurrency: "MXN",
      source: "MANUAL",
      status: "COMPLETED",
      frictionBreakdown: {
        grossAmount: 6614,
        brokerCommission: 16.53,
        brokerIva: 2.64,
        otherFees: 0,
        totalFrictionCost: 19.17,
        finalNetCost: 6633.17,
        adjustedUnitPrice: 3316.585,
        perUnitFriction: 9.585,
        reviewStatus: "OK",
      },
    };
  }
  // Legacy manual with only a flat fee: no fine-grained split persisted.
  return {
    id: "tx-old",
    assetSymbol: "WALMEX",
    assetType: "STOCK",
    transactionType: "BUY",
    transactionDate: "2025-10-01T15:00:00Z",
    quantity: 10,
    pricePerUnit: 70,
    grossAmount: 700,
    fee: 23.2,
    feeCurrency: "MXN",
    source: "MANUAL",
    status: "COMPLETED",
    frictionBreakdown: null,
  };
}

// Open the inline editor for the row whose Assets cell shows `symbol`.
async function openEditor(page: import("@playwright/test").Page, symbol: string) {
  const row = page.locator("table tbody tr", { hasText: symbol }).first();
  await row.getByRole("button", { name: "Transaction actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const editor = page.getByTestId("inline-transaction-editor");
  await expect(editor).toBeVisible({ timeout: 15_000 });
  return editor;
}

test.describe("Edición de transacción — paridad Comisión/IVA (ADR-0005)", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90_000);
    // Desktop width so the `md:block` transactions table (and its inline editor)
    // renders; the mobile card layout has no Comisión/IVA split.
    await page.setViewportSize({ width: 1280, height: 900 });

    await mockBackendAPIs(page);
    await loginAs(page);

    // Overrides registered AFTER mockBackendAPIs win by LIFO route precedence.
    // The list is fetched via the same-origin BFF (/api/me/transactions); details
    // and the PUT go to the direct backend (/api/v1/me/transactions/...).
    const fulfillList = (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: LIST });
    await page.route(/\/api\/me\/transactions(\?|$)/, fulfillList);
    await page.route(/\/api\/v1\/me\/transactions(\?|$)/, fulfillList);
    await page.route(/\/api\/v1\/me\/transactions\/details\/[^/]+/, (route) => {
      const m = route.request().url().match(/details\/([^/?]+)/);
      const id = m ? decodeURIComponent(m[1]) : "";
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(detailsBody(id)) });
    });

    await page.goto("/transactions");
    await page.locator("table tbody tr", { hasText: "NVDA" }).first().waitFor({ timeout: 30_000 });
  });

  test("siembra el split desde el FrictionBreakdown del backend (16.53 + 2.64)", async ({ page }) => {
    const editor = await openEditor(page, "NVDA");

    await expect(editor.getByTestId("edit-broker-commission")).toHaveValue("16.53");
    await expect(editor.getByTestId("edit-broker-iva")).toHaveValue("2.64");
    // formatFeeCurrency(19.17, "MXN") → "MX$19.1700" (4 decimales, igual que el alta).
    await expect(editor.getByTestId("edit-total-costs")).toHaveText("MX$19.1700");
  });

  test("editar un costo manda {brokerCommission, brokerIva} SIN fee", async ({ page }) => {
    let putBody: Record<string, unknown> | null = null;
    await page.route(/\/api\/v1\/me\/transactions\/tx-nvda(\?|$)/, (route) => {
      if (route.request().method() === "PUT") {
        putBody = route.request().postDataJSON();
        return route.fulfill({ status: 200, contentType: "application/json", body: LIST });
      }
      return route.fallback();
    });

    const editor = await openEditor(page, "NVDA");
    // Cambiar la comisión (IVA queda en 2.64: viene sembrado del breakdown → ivaTouched).
    await editor.getByTestId("edit-broker-commission").fill("20");
    await editor.getByRole("button", { name: "Save", exact: true }).click();

    await expect(editor).toBeHidden({ timeout: 15_000 });
    expect(putBody, "el editor debe emitir un PUT").not.toBeNull();
    const body = putBody as unknown as Record<string, unknown>;
    expect(body.brokerCommission).toBe(20);
    expect(body.brokerIva).toBe(2.64);
    // ADR-0005: split XOR fee → al mandar split NO se envía fee plano.
    expect(body).not.toHaveProperty("fee");
  });

  test("sin breakdown: decompone el fee MXN (20.00 + 3.20) y conserva el fee en edición ajena a costos", async ({ page }) => {
    let putBody: Record<string, unknown> | null = null;
    await page.route(/\/api\/v1\/me\/transactions\/tx-old(\?|$)/, (route) => {
      if (route.request().method() === "PUT") {
        putBody = route.request().postDataJSON();
        return route.fulfill({ status: 200, contentType: "application/json", body: LIST });
      }
      return route.fallback();
    });

    const editor = await openEditor(page, "WALMEX");
    // Fallback de descomposición: 23.20 / 1.16 = 20.00 comisión, 3.20 IVA.
    await expect(editor.getByTestId("edit-broker-commission")).toHaveValue("20");
    await expect(editor.getByTestId("edit-broker-iva")).toHaveValue("3.2");
    await expect(editor.getByTestId("edit-total-costs")).toHaveText("MX$23.2000");

    // Editar SOLO las notas (no toca costos) → se reenvía el fee original, sin split.
    await editor.getByPlaceholder("Exchange, memo...").fill("nota editada");
    await editor.getByRole("button", { name: "Save", exact: true }).click();

    await expect(editor).toBeHidden({ timeout: 15_000 });
    expect(putBody, "el editor debe emitir un PUT").not.toBeNull();
    const body = putBody as unknown as Record<string, unknown>;
    expect(body.fee).toBe(23.2);
    expect(body).not.toHaveProperty("brokerCommission");
    expect(body).not.toHaveProperty("brokerIva");
  });
});
