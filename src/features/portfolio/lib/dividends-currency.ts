// Zen "ingreso por moneda" grouping for the Dividends tab. Income is grouped by
// the dividend's NATIVE currency and the proportion is by NUMBER of paying
// holdings (unit-free, comparable across currencies) — amounts are never summed
// or converted across currencies (ADR-0010 keeps cross-currency aggregation on
// the backend / presentation layer).
export type CurrencyIncomeGroup = {
  currency: string;
  total: number; // Σ annual income within THIS currency (same unit → safe to sum)
  count: number; // number of holdings paying in this currency
  share: number; // count / total paying holdings, 0..1
};

export function groupIncomeByCurrency(
  payers: ReadonlyArray<{ currency: string; annualIncome: number }>,
): CurrencyIncomeGroup[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const p of payers) {
    const g = map.get(p.currency) ?? { total: 0, count: 0 };
    g.total += p.annualIncome;
    g.count += 1;
    map.set(p.currency, g);
  }

  const totalCount = payers.length || 1;
  return Array.from(map.entries())
    .map(([currency, { total, count }]) => ({ currency, total, count, share: count / totalCount }))
    .sort((a, b) => b.count - a.count || a.currency.localeCompare(b.currency));
}

// Dividend yield = annual income / current value, as a fraction (0.0159 = 1.59%).
// It is only meaningful when the dividend's native currency matches the currency
// the value is expressed in (ADR-0010 display currency). Cross-currency yield
// needs an FX conversion the backend owns, so here it returns null and the UI
// shows it as not available rather than inflating it by the FX ratio.
export function computeDividendYield(
  annualIncome: number,
  currentValue: number,
  dividendCurrency: string,
  displayCurrency: string,
): number | null {
  if (dividendCurrency !== displayCurrency) return null;
  if (!(currentValue > 0) || annualIncome <= 0) return null;
  return annualIncome / currentValue;
}

// ADR-0031 — which yield the UI shows. The backend's `yieldPct` is computed in
// the asset's native currency (trailing DPS ÷ current native-currency price), so
// it is cross-currency safe and authoritative whenever present: a number shows
// that %, an explicit null means "no history / price unavailable" (→ "—"). Only
// when the field is ABSENT (undefined — a pre-deploy backend that doesn't send it
// yet) do we fall back to the local same-currency computation, which still
// returns null for cross-currency pairs. This lets the UI work before and after
// the backend deploy with no further change.
export function resolveDividendYield(
  backendYieldPct: number | null | undefined,
  annualIncome: number,
  currentValue: number,
  dividendCurrency: string,
  displayCurrency: string,
): number | null {
  if (backendYieldPct !== undefined) return backendYieldPct;
  return computeDividendYield(annualIncome, currentValue, dividendCurrency, displayCurrency);
}
