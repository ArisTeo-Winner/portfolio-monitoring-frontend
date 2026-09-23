// @ts-check
/**
 * Mide la densidad REAL (número de puntos) de la serie /history del backend,
 * comparando activos (p. ej. GOOG stock vs. BNB crypto) para un mismo rango.
 *
 * A diferencia de la suite e2e (tests/e2e/helpers.ts), este script NO mockea
 * nada: se autentica contra el backend real y lee las respuestas vivas del
 * endpoint que consume el gráfico:
 *
 *   GET {NEXT_PUBLIC_API_BASE_URL}/api/v1/me/portfolio/assets/{symbol}/history?range=...
 *
 * Requisitos:
 *   - `npm run dev` corriendo en http://localhost:3000 (o BASE_URL).
 *   - Backend real accesible en NEXT_PUBLIC_API_BASE_URL (http://localhost:8080).
 *   - Credenciales por variables de entorno (el script las lee; nunca se escriben
 *     en el repo):  E2E_EMAIL=...  E2E_PASSWORD=...
 *
 * Uso (PowerShell):
 *   $env:E2E_EMAIL="tu@correo"; $env:E2E_PASSWORD="tu-clave"; `
 *     node scripts/measure-history-density.mjs
 *
 * Uso (bash):
 *   E2E_EMAIL=tu@correo E2E_PASSWORD=tu-clave node scripts/measure-history-density.mjs
 *
 * Opcionales:
 *   BASE_URL=http://localhost:3000   SYMBOLS=GOOG,BNB   RANGES=3M
 *   HEADED=1  (abre el navegador visible en lugar de headless)
 */

import { chromium } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
const SYMBOLS = (process.env.SYMBOLS ?? "GOOG,BNB").split(",").map((s) => s.trim()).filter(Boolean);
const RANGES = (process.env.RANGES ?? "3M").split(",").map((s) => s.trim()).filter(Boolean);
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const HEADED = process.env.HEADED === "1";

if (!EMAIL || !PASSWORD) {
  console.error(
    "\n[measure-history-density] Faltan credenciales.\n" +
      "Exporta E2E_EMAIL y E2E_PASSWORD antes de ejecutar (el script las lee de env;\n" +
      "no se guardan en el repo). Ejemplo bash:\n" +
      "  E2E_EMAIL=tu@correo E2E_PASSWORD=clave node scripts/measure-history-density.mjs\n",
  );
  process.exit(2);
}

function summarize(symbol, range, status, points) {
  const n = points.length;
  const first = points[0]?.time ?? null;
  const last = points[n - 1]?.time ?? null;
  const spanSec = first != null && last != null ? last - first : 0;
  const cadenceSec = n > 1 ? spanSec / (n - 1) : 0;
  const iso = (t) => (t != null ? new Date(t * 1000).toISOString().slice(0, 16) : "—");
  return {
    symbol,
    range,
    status,
    puntos: n,
    desde: iso(first),
    hasta: iso(last),
    horas_entre_puntos: n > 1 ? +(cadenceSec / 3600).toFixed(2) : 0,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: !HEADED });
  const context = await browser.newContext();
  const page = await context.newPage();
  const rows = [];

  try {
    // ── Login real (sin mocks) ────────────────────────────────────────────
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    const heading = page.getByRole("heading", { name: /bienvenido/i });
    if (!(await heading.isVisible({ timeout: 1_500 }).catch(() => false))) {
      await page
        .locator(
          '[data-testid="open-login-btn-mobile"]:visible, [data-testid="open-login-btn-desktop"]:visible',
        )
        .first()
        .click();
    }
    await page.getByTestId("email-input").locator("input").fill(EMAIL);
    await page.getByTestId("password-input").locator("input").fill(PASSWORD);
    await page.getByTestId("submit-login").click();
    await page.waitForURL(/\/portfolio/, { timeout: 60_000 });
    console.log("[measure-history-density] login OK");

    // ── Captura /history por símbolo y rango ──────────────────────────────
    // Se ejecuta DENTRO de la página autenticada (origin = BASE_URL): se acuña
    // un token vía el BFF de refresh (usa la cookie HttpOnly puesta por el login)
    // y se golpea el endpoint real directamente, igual que hace el cliente de la
    // app. Esto evita la carrera de render/refresh de una recarga dura.
    const results = await page.evaluate(
      async ({ apiBase, symbols, ranges }) => {
        const r = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!r.ok) throw new Error(`refresh falló: HTTP ${r.status}`);
        const { accessToken } = await r.json();
        const hdr = { Authorization: `Bearer ${accessToken}` };

        const out = [];
        for (const symbol of symbols) {
          for (const range of ranges) {
            const res = await fetch(
              `${apiBase}/api/v1/me/portfolio/assets/${encodeURIComponent(symbol)}/history?range=${range}`,
              { headers: hdr, credentials: "include", cache: "no-store" },
            );
            let points = [];
            if (res.ok) {
              const b = await res.json();
              points = Array.isArray(b) ? b : b?.points ?? b?.series ?? [];
            }
            out.push({ symbol, range, status: res.status, points });
          }
        }
        return out;
      },
      { apiBase: API_BASE, symbols: SYMBOLS, ranges: RANGES },
    );

    for (const { symbol, range, status, points } of results) {
      rows.push(summarize(symbol, range, status, points));
    }

    console.log("\n=== Densidad de la serie /history (backend real) ===");
    console.table(rows);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error("[measure-history-density] error:", err);
  process.exit(1);
});
