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
