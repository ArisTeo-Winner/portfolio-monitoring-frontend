import { test, expect } from "@playwright/test";
import { loginAs, mockBackendAPIs } from "./helpers";
import { skipUnlessXsMobile } from "./project-guards";

// Dividends tab — Zen "ingreso por moneda" (currency diversification) and the
// Detallado "Rendim." (dividend yield) column. Portfolio is mocked with
// dividend-paying stocks in two currencies (USD + MXN) plus a non-payer, so the
// grouping, the never-sum-across-currencies rule and the same-currency yield
// guard are all exercised deterministically.

type NextDiv = {
  exDividendDate: string | null;
  paymentDate: string | null;
  amountPerShare: number;
  currency: string;
  frequency: number | null;
};
type Div = {
  dps: number;
  currency: string;
  cagr5y: number;
  status?: "PAYS" | "NONE" | "ERROR" | "UNKNOWN";
  next?: NextDiv;
};
const DIV: Record<string, Div> = {
  AAPL: {
    dps: 0.96,
    currency: "USD",
    cagr5y: 0.065,
    status: "PAYS", // paga histórico PERO sin nextDividend → el chip NO debe reventar
  },
  KO: {
    dps: 1.94,
    currency: "USD",
    cagr5y: 0.034, // 155.20 USD / 5000 USD = 3.10%
    status: "PAYS",
    // Soonest upcoming payment across the three payers → drives the Zen card.
    next: { exDividendDate: "2027-03-10", paymentDate: "2027-03-24", amountPerShare: 0.485, currency: "USD", frequency: 4 },
  },
  WALMEX: {
    dps: 0.88,
    currency: "MXN",
    cagr5y: 0.121, // MXN div, USD value → yield "—"
    status: "PAYS",
    next: { exDividendDate: "2027-06-01", paymentDate: "2027-06-15", amountPerShare: 0.22, currency: "MXN", frequency: 4 },
  },
  TSLA: { dps: 0, currency: "USD", cagr5y: 0, status: "NONE" }, // confirmed non-payer → "Sin dividendos"
  CRCL: { dps: 0, currency: "USD", cagr5y: 0, status: "UNKNOWN" }, // not yet verified → "Verificando…"
};
const META: Record<string, { qty: string; value: string }> = {
  AAPL: { qty: "40", value: "9000" },
  KO: { qty: "80", value: "5000" },
  WALMEX: { qty: "200", value: "1200" },
  TSLA: { qty: "5", value: "2000" },
  CRCL: { qty: "10", value: "800" },
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
      const pays = Boolean(d && d.dps > 0);
      const body = pays
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
            eligibilityStatus: d.status ?? "PAYS",
            lastCheckedAt: "2026-11-07T15:13:45-06:00",
            nextDividend: d.next ?? null,
          }
        : {
            symbol: sym,
            annualDividends: [],
            cagr1y: null,
            cagr3y: null,
            cagr5y: null,
            cagr10y: null,
            currency: d?.currency ?? "USD",
            eligibilityStatus: d?.status ?? "UNKNOWN",
            lastCheckedAt: d?.status === "UNKNOWN" ? null : "2026-11-07T15:13:45-06:00",
            nextDividend: null,
          };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });

    // ADR-0029 "Mis Dividendos": received dividends with the user's own amounts.
    // KO (USD, with tax), WALMEX (MXN) and a legacy KO row with null shares/DPS → "—".
    await page.route(/\/api\/v1\/me\/dividends(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            symbol: "KO",
            assetName: "Coca-Cola Company",
            logoUrl: null,
            exDate: "2026-06-14",
            paymentDate: "2026-07-01T04:00:00Z",
            shares: 80,
            amountPerShare: 0.485,
            grossAmount: 38.8,
            taxWithheld: 5.82,
            netAmount: 32.98,
            type: "CASH",
            currency: "USD",
          },
          {
            symbol: "WALMEX",
            assetName: "Wal-Mart de México",
            logoUrl: null,
            exDate: "2026-05-20",
            paymentDate: "2026-06-01T04:00:00Z",
            shares: 200,
            amountPerShare: 0.22,
            grossAmount: 44.0,
            taxWithheld: 0,
            netAmount: 44.0,
            type: "CASH",
            currency: "MXN",
          },
          {
            symbol: "KO",
            assetName: "Coca-Cola Company",
            logoUrl: null,
            exDate: null,
            paymentDate: "2025-10-01T04:00:00Z",
            shares: null, // legacy pre-migration row → "—"
            amountPerShare: null,
            grossAmount: 36.0,
            taxWithheld: 0,
            netAmount: 36.0,
            type: "CASH",
            currency: "USD",
          },
        ]),
      }),
    );

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
    // Scope to the Detallado table — "Mis Dividendos" also renders KO/WALMEX rows.
    const detail = page.getByTestId("dividends-detail-table");

    // KO: 155.20 USD / 5000 USD = 3.10% (misma moneda → yield visible).
    await expect(detail.locator("tr", { hasText: "KO" })).toContainText("3.10%");

    // WALMEX: dividendo en MXN con valor en USD → cross-currency → "—".
    const walmexRow = detail.locator("tr", { hasText: "WALMEX" });
    await expect(walmexRow).toContainText("$176.00 MXN");
    await expect(walmexRow).toContainText("—");
  });

  test("Zen muestra el próximo pago más cercano (el soonest por fecha)", async ({ page }) => {
    const card = page.getByTestId("dividends-next-payment");
    await expect(card).toBeVisible();
    // KO paga el 2027-03-24 (más cercano que AAPL 05-15 y WALMEX 06-15).
    await expect(card).toContainText("USD/acción");
    await expect(card).toContainText("2027");
    await expect(card).toContainText("trimestral");
    await expect(card).toContainText("Ex-dividendo");
  });

  test("Zen separa elegibilidad: paga vs verificando vs no reparte", async ({ page }) => {
    // UNKNOWN → sección "Verificando…" (nunca como "no paga").
    const verifying = page.getByTestId("dividends-verifying");
    await expect(verifying).toBeVisible();
    await expect(verifying).toContainText("Verificando");
    await expect(verifying).toContainText("CRCL");

    // NONE confirmado → chip "Sin dividendos".
    await expect(page.getByText("Sin dividendos")).toBeVisible();
  });

  test("Detallado muestra badge de estado y próximo pago/ex-dividendo", async ({ page }) => {
    await page.getByRole("button", { name: "Detallado" }).click();
    await expect(page.getByRole("columnheader", { name: "Próximo pago" })).toBeVisible();
    // Scope to the Detallado table — "Mis Dividendos" también pinta filas KO/WALMEX.
    const detail = page.getByTestId("dividends-detail-table");

    // Badge por holding (el front es dueño del texto es-MX).
    const koRow = detail.locator("tr", { hasText: "KO" });
    await expect(koRow.getByTestId("dividend-status-badge")).toHaveText("Paga dividendos");
    await expect(koRow).toContainText("$0.49 USD"); // amountPerShare 0.485 → redondeo en-US

    const crclRow = detail.locator("tr", { hasText: "CRCL" });
    await expect(crclRow.getByTestId("dividend-status-badge")).toHaveText("Verificando…");

    const tslaRow = detail.locator("tr", { hasText: "TSLA" });
    await expect(tslaRow.getByTestId("dividend-status-badge")).toHaveText("No reparte dividendos");

    // WALMEX próximo pago en su moneda nativa (MXN), no sumada a USD.
    const walmexRow = detail.locator("tr", { hasText: "WALMEX" });
    await expect(walmexRow).toContainText("$0.22 MXN");

    // AAPL: PAYS sin nextDividend → badge "Paga dividendos" pero Próximo pago "—"
    // (el caso que el backend advirtió que NO debe romper el chip).
    const aaplRow = detail.locator("tr", { hasText: "AAPL" });
    await expect(aaplRow.getByTestId("dividend-status-badge")).toHaveText("Paga dividendos");
    await expect(aaplRow).toContainText("—");
  });

  test("PAYS sin nextDividend no rompe la tarjeta ni la fila de próximo pago (Zen)", async ({ page }) => {
    // AAPL paga pero no tiene anuncio vigente; la tarjeta usa el soonest (KO) y
    // AAPL sigue apareciendo en "Quién te paga" sin reventar.
    await expect(page.getByTestId("dividends-next-payment")).toBeVisible();
    await expect(page.getByText("Quién te paga")).toBeVisible();
    const payers = page.locator('[data-testid="portfolio-dividends"]');
    await expect(payers).toContainText("AAPL");
  });

  test("Mis Dividendos lista lo recibido con neto, retención y moneda por fila (ADR-0029)", async ({ page }) => {
    const section = page.getByTestId("my-dividends");
    await expect(section).toBeVisible();
    await expect(section).toContainText("Mis dividendos recibidos");

    // KO USD con retención → neto $32.98 USD; WALMEX MXN → $44.00 MXN (moneda por fila).
    const koRow = section.locator("tr", { hasText: "KO" }).first();
    await expect(koRow).toContainText("$32.98 USD");
    const walmexRow = section.locator("tr", { hasText: "WALMEX" });
    await expect(walmexRow).toContainText("$44.00 MXN");

    // Totales por moneda (neto), sin sumar entre monedas: USD 32.98+36.00 = 68.98.
    await expect(section).toContainText("$68.98");
    await expect(section).toContainText("MXN");

    // Fila legacy (shares/amountPerShare null) → "—".
    await expect(section).toContainText("—");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADR-0031 — rendimiento cross-currency-safe desde el backend (yieldPct).
//
// A diferencia del bloque de arriba (donde /growth NO manda yieldPct y la UI cae
// al cálculo local same-currency), aquí el mock SÍ incluye yieldPct/priceBasis
// para probar que resolveDividendYield prefiere SIEMPRE el valor del backend,
// en AMBAS direcciones:
//
//   • BIMBOA  — dividendo en MXN, valor mostrado en USD (cross-currency). El
//     cálculo local devolvería null; el backend manda yieldPct 0.0312 (nativo
//     MXN) → la UI muestra "3.12%". El % sale del ratio nativo, NO se multiplica
//     por FX, y es independiente de la moneda de display (aquí USD ≠ MXN).
//   • KO      — dividendo en USD, valor en USD, CON historial (el cálculo local
//     daría 3.10%), pero el backend manda yieldPct: null → la UI muestra "—".
//     Nunca fabricamos un fallback cuando el backend dice null explícito.
//
// Celda "Rendim." = td.nth(3) (Holding, Acciones, Dividendo/año, Rendim., …).
// Se compara el texto renderizado, que ya es yieldPct × 100 con 2 decimales.
// ─────────────────────────────────────────────────────────────────────────────

type GrowthMock = {
  dividendCurrency: string; // moneda nativa del dividendo (annualDividends + próximo)
  dps: number; // DPS del último año (para annualIncome)
  yieldPct: number | null; // ADR-0031: ratio nativo, o null explícito
  priceBasis: { price: number; currency: string; asOf: string } | null;
};

const SHAPE: Record<string, { qty: string; value: string; growth: GrowthMock }> = {
  // Cross-currency: paga MXN, valor en USD. Local → null; backend yieldPct gana.
  BIMBOA: {
    qty: "300",
    value: "1500", // USD (display) → distinto de la moneda del dividendo (MXN)
    growth: {
      dividendCurrency: "MXN",
      dps: 2.5, // 2.50 MXN × 300 = 750.00 MXN anual (nativo, nunca sumado a USD)
      yieldPct: 0.0312, // 2.50 / 80.13 ≈ 3.12% nativo → UI "3.12%"
      priceBasis: { price: 80.13, currency: "MXN", asOf: "2026-11-07T15:13:45-06:00" },
    },
  },
  // Same-currency CON historial: local daría 3.10%, pero backend null → "—".
  KO: {
    qty: "80",
    value: "5000", // USD
    growth: {
      dividendCurrency: "USD",
      dps: 1.94, // 1.94 × 80 = 155.20 USD (local sería 155.20/5000 = 3.10%)
      yieldPct: null, // null explícito del backend → no fabricar fallback
      priceBasis: null, // yieldPct y priceBasis viajan juntos (ambos null)
    },
  },
};
const SHAPE_SYMBOLS = Object.keys(SHAPE);

function shapeEntry(assetSymbol: string) {
  const { qty, value } = SHAPE[assetSymbol];
  return {
    portfolioEntryId: `pe-${assetSymbol}`,
    userId: "u1",
    assetSymbol,
    assetType: "STOCK",
    totalQuantity: qty,
    currentValue: value,
    totalInvested: "1000",
    totalProfitLoss: "100",
    averagePricePerUnit: "45",
    lastTransactionPrice: "50",
    lastUpdated: "2026-01-15T10:00:00Z",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
  };
}

test.describe("Dividendos — rendimiento ADR-0031 (yieldPct del backend)", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    skipUnlessXsMobile(testInfo);
    test.setTimeout(90_000);

    await mockBackendAPIs(page);

    await page.route(/\/api\/v1\/me\/portfolio(\?|$)/, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(SHAPE_SYMBOLS.map(shapeEntry)),
      }),
    );

    await page.route(/\/api\/v1\/market\/dividends\/[^/]+\/growth/, (route) => {
      const m = route.request().url().match(/dividends\/([^/]+)\/growth/);
      const sym = m ? decodeURIComponent(m[1]) : "";
      const g = SHAPE[sym]?.growth;
      const body = g
        ? {
            symbol: sym,
            annualDividends: [
              { year: 2024, totalDps: g.dps * 0.95 },
              { year: 2025, totalDps: g.dps },
            ],
            cagr1y: 0.05,
            cagr3y: 0.05,
            cagr5y: 0.05,
            cagr10y: 0.05,
            currency: g.dividendCurrency,
            eligibilityStatus: "PAYS",
            lastCheckedAt: "2026-11-07T15:13:45-06:00",
            nextDividend: null,
            // ADR-0031: ambos presentes o ambos null, nunca uno sí y otro no.
            yieldPct: g.yieldPct,
            priceBasis: g.priceBasis,
          }
        : {
            symbol: sym,
            annualDividends: [],
            cagr1y: null,
            cagr3y: null,
            cagr5y: null,
            cagr10y: null,
            currency: "USD",
            eligibilityStatus: "UNKNOWN",
            lastCheckedAt: null,
            nextDividend: null,
            yieldPct: null,
            priceBasis: null,
          };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });

    await page.route(/\/api\/v1\/me\/dividends(\?|$)/, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    );

    await loginAs(page);
    await page.goto("/portfolio");
    await page.getByTestId("bottom-navigation").waitFor({ state: "attached", timeout: 60_000 });
    await page.getByRole("button", { name: "Dividendos" }).click();
    await page.getByTestId("portfolio-dividends").waitFor({ timeout: 20_000 });
    await page.getByRole("button", { name: "Detallado" }).click();
    await expect(page.getByRole("columnheader", { name: "Rendim." })).toBeVisible();
  });

  test("usa el yieldPct del backend en cross-currency (MXN→USD): muestra 3.12%", async ({ page }) => {
    const detail = page.getByTestId("dividends-detail-table");
    const row = detail.locator("tr", { hasText: "BIMBOA" });

    // Dividendo/año en la moneda NATIVA del activo (MXN), nunca convertido a USD.
    await expect(row.locator("td").nth(2)).toContainText("MXN");

    // Rendim. = yieldPct × 100. El cálculo local sería null (dividendo MXN vs
    // valor USD); el backend manda el ratio nativo → la UI lo muestra tal cual,
    // independiente de la moneda de display.
    await expect(row.locator("td").nth(3)).toHaveText("3.12%");
  });

  test("respeta yieldPct: null del backend aunque el cálculo local daría un número", async ({ page }) => {
    const detail = page.getByTestId("dividends-detail-table");
    const row = detail.locator("tr", { hasText: "KO" });

    // KO es same-currency (USD/USD) con historial: 155.20/5000 = 3.10% localmente.
    // Pero el backend manda yieldPct: null → no fabricamos fallback, va "—".
    await expect(row.locator("td").nth(3)).toHaveText("—");
  });
});
