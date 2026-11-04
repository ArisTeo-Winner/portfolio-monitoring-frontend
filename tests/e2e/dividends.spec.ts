import { test, expect } from "@playwright/test";
import { loginAs, mockBackendAPIs } from "./helpers";
import { skipUnlessXsMobile } from "./project-guards";

// Dividends tab — Zen "ingreso por moneda" (currency diversification) and the
// Detallado "Rendim." (dividend yield) column. Portfolio is mocked with
// dividend-paying stocks in two currencies (USD + MXN) plus a non-payer, so the
// grouping, the never-sum-across-currencies rule and the same-currency yield
// guard are all exercised deterministically.

type Div = { dps: number; currency: string; cagr5y: number };
const DIV: Record<string, Div> = {
  AAPL: { dps: 0.96, currency: "USD", cagr5y: 0.065 },
  KO: { dps: 1.94, currency: "USD", cagr5y: 0.034 }, // 155.20 USD / 5000 USD = 3.10%
  WALMEX: { dps: 0.88, currency: "MXN", cagr5y: 0.121 }, // MXN div, USD value → yield "—"
  TSLA: { dps: 0, currency: "USD", cagr5y: 0 }, // non-payer → "Sin dividendos"
};
const META: Record<string, { qty: string; value: string }> = {
  AAPL: { qty: "40", value: "9000" },
  KO: { qty: "80", value: "5000" },
  WALMEX: { qty: "200", value: "1200" },
  TSLA: { qty: "5", value: "2000" },
};
const SYMBOLS = Object.keys(DIV);

function entry(assetSymbol: string) {
  const { qty, value } = META[assetSymbol];
  return {
    portfolioEntryId: `pe-${assetSymbol}`,
    userId: "u1",
    assetSymbol,
    assetType: "STOCK",
    totalQuantity: qty,
    currentValue: value,
    totalInvested: "900",
    totalProfitLoss: "100",
    averagePricePerUnit: "45",
    lastTransactionPrice: "50",
    lastUpdated: "2026-01-15T10:00:00Z",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
  };
}

test.describe("Dividendos — ingreso por moneda (Zen) + rendimiento (Detallado)", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessXsMobile(testInfo);
    test.setTimeout(90_000);

    await mockBackendAPIs(page);

    await page.route(/\/api\/v1\/me\/portfolio(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SYMBOLS.map(entry)),
      }),
    );

    await page.route(/\/api\/v1\/market\/dividends\/[^/]+\/growth/, (route) => {
      const m = route.request().url().match(/dividends\/([^/]+)\/growth/);
      const sym = m ? decodeURIComponent(m[1]) : "";
      const d = DIV[sym];
      const body =
        d && d.dps > 0
          ? {
              symbol: sym,
              annualDividends: [
                { year: 2024, totalDps: d.dps * 0.95 },
                { year: 2025, totalDps: d.dps },
              ],
              cagr1y: d.cagr5y,
              cagr3y: d.cagr5y,
              cagr5y: d.cagr5y,
              cagr10y: d.cagr5y,
              currency: d.currency,
            }
          : { symbol: sym, annualDividends: [], cagr1y: null, cagr3y: null, cagr5y: null, cagr10y: null, currency: "USD" };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });

    await loginAs(page);
    await page.goto("/portfolio");
    await page.getByTestId("bottom-navigation").waitFor({ state: "attached", timeout: 60_000 });
    await page.getByRole("button", { name: "Dividendos" }).click();
    await page.getByTestId("portfolio-dividends").waitFor({ timeout: 20_000 });
  });

  test("Zen agrupa el ingreso por moneda sin sumar entre monedas", async ({ page }) => {
    const section = page.getByTestId("dividends-currency-diversification");
    await expect(section).toBeVisible();
    await expect(section).toContainText("2 monedas");
    await expect(section).toContainText("USD");
    await expect(section).toContainText("MXN");
    await expect(section).toContainText("Los montos no se suman entre monedas");
  });

  test("Detallado muestra rendimiento solo cuando dividendo y valor comparten moneda", async ({ page }) => {
    await page.getByRole("button", { name: "Detallado" }).click();
    await expect(page.getByRole("columnheader", { name: "Rendim." })).toBeVisible();

    // KO: 155.20 USD / 5000 USD = 3.10% (misma moneda → yield visible).
    await expect(page.locator("tr", { hasText: "KO" })).toContainText("3.10%");

    // WALMEX: dividendo en MXN con valor en USD → cross-currency → "—".
    const walmexRow = page.locator("tr", { hasText: "WALMEX" });
    await expect(walmexRow).toContainText("$176.00 MXN");
    await expect(walmexRow).toContainText("—");
  });
});
