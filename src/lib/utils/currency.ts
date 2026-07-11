import { formatCurrency } from "@/lib/utils/format";

export type CurrencyCode = "MXN" | "USD";

/**
 * Infers the settlement currency of an asset from its symbol.
 * BMV-listed symbols use the trailing "*" convention (e.g. "AAPL*"),
 * which DataBursatil/BMV feeds already price natively in MXN.
 */
export function getAssetCurrency(symbol: string): CurrencyCode {
  return symbol.trim().toUpperCase().endsWith("*") ? "MXN" : "USD";
}

/**
 * Encodes a symbol for use in a URL path segment, escaping "*" as %2A.
 * encodeURIComponent does NOT escape "*" (it is an RFC 3986 "unreserved" char),
 * but the backend route requires it literally percent-encoded.
 */
export function encodeBmvSymbol(symbol: string): string {
  return encodeURIComponent(symbol).replace(/\*/g, "%2A");
}

export function formatCurrencyByCode(value: string | number, currency: CurrencyCode): string {
  if (currency === "USD") return formatCurrency(value);

  const amount = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export type PortfolioCurrencyTotals = {
  // True when a usable USD/MXN rate was available and MXN positions were
  // converted into the combined USD total. False means the rate couldn't be
  // fetched — totalUsd/totalMxn are then the raw, unconverted per-currency
  // subtotals (nothing was mixed together).
  combined: boolean;
  totalUsd: number;
  totalMxn: number;
};

/**
 * Aggregates currentValue across portfolio entries into a single USD figure,
 * converting MXN-denominated (BMV) positions with the live USD/MXN rate.
 * Positions never get summed across currencies without conversion: if the
 * rate is unavailable, the two currency subtotals are returned separately
 * instead of being added together raw.
 */
export function computePortfolioTotals(
  entries: Array<{ assetSymbol: string; currentValue: string | number }>,
  usdMxnRate: number | null | undefined,
): PortfolioCurrencyTotals {
  let usdSum = 0;
  let mxnSum = 0;

  for (const entry of entries) {
    const amount = typeof entry.currentValue === "string" ? Number(entry.currentValue) : entry.currentValue;
    const value = Number.isFinite(amount) ? amount : 0;
    if (getAssetCurrency(entry.assetSymbol) === "MXN") {
      mxnSum += value;
    } else {
      usdSum += value;
    }
  }

  const rateAvailable = typeof usdMxnRate === "number" && Number.isFinite(usdMxnRate) && usdMxnRate > 0;
  if (!rateAvailable) {
    return { combined: false, totalUsd: usdSum, totalMxn: mxnSum };
  }

  const totalUsd = usdSum + mxnSum / usdMxnRate;
  return { combined: true, totalUsd, totalMxn: totalUsd * usdMxnRate };
}

/**
 * Renders portfolio totals for display. When the rate was available, this is
 * a single combined USD figure. Otherwise it falls back to showing the two
 * currency subtotals side by side rather than a mixed/incorrect number.
 */
export function formatPortfolioTotal(totals: PortfolioCurrencyTotals): string {
  if (totals.combined) return formatCurrency(totals.totalUsd);

  const parts: string[] = [];
  if (totals.totalUsd > 0) parts.push(formatCurrencyByCode(totals.totalUsd, "USD"));
  if (totals.totalMxn > 0) parts.push(formatCurrencyByCode(totals.totalMxn, "MXN"));
  return parts.length ? parts.join(" + ") : formatCurrency(0);
}
