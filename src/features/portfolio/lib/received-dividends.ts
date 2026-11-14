import type { ReceivedDividend } from "@/features/portfolio/types/received-dividend.types";

export type ReceivedDividendTotal = {
  currency: string;
  net: number;
  gross: number;
  count: number;
};

// Sum received dividends per currency — never across currencies (ADR-0010).
// Sorted by net total desc, then currency name for a stable order.
export function summarizeReceivedByCurrency(rows: ReceivedDividend[]): ReceivedDividendTotal[] {
  const map = new Map<string, ReceivedDividendTotal>();
  for (const row of rows) {
    const current = map.get(row.currency) ?? { currency: row.currency, net: 0, gross: 0, count: 0 };
    current.net += row.netAmount;
    current.gross += row.grossAmount;
    current.count += 1;
    map.set(row.currency, current);
  }
  return Array.from(map.values()).sort((a, b) => b.net - a.net || a.currency.localeCompare(b.currency));
}
