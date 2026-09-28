import { formatCurrency } from "@/lib/utils/format";
import type { PresentationEnvelope } from "@/features/portfolio/types/presentation.types";

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

// ── ADR-0010 presentation-currency helpers ──────────────────────────────────
// Backward-compatible groundwork: safe to use before the backend ships the
// envelope (they no-op / fall back to USD). Not yet wired into the views.

/**
 * The currency the backend already expressed the money fields in. Reads the
 * presentation envelope and falls back to USD when it is absent (pre-ADR-0010
 * backend) or empty — so the UI behaves exactly as today until MXN is chosen.
 */
export function resolveDisplayCurrency(presentation?: PresentationEnvelope | null): string {
  const code = presentation?.displayCurrency?.trim().toUpperCase();
  return code || "USD";
}

/**
 * Presentation-currency formatter for portfolio valuation views (ADR-0010
 * action #1). Keeps USD output byte-identical to `formatCurrency` (so existing
 * visual baselines stay green) and appends the code only for a non-USD display
 * currency (e.g. "$1,554.49 MXN"), which is what the backend now converts money
 * into. Pass the display currency from `resolveDisplayCurrency(presentation)`.
 */
export function formatDisplayMoney(value: string | number, displayCurrency: string): string {
  const code = (displayCurrency || "USD").trim().toUpperCase();
  if (code === "USD") return formatCurrency(value);
  return formatMoneyInCurrency(value, code);
}

/**
 * Signed variant of {@link formatDisplayMoney} ("+$X", "-$X MXN"). USD output
 * matches `formatSignedCurrency`, so visual baselines stay green.
 */
export function formatSignedDisplayMoney(value: string | number, displayCurrency: string): string {
  const amount = typeof value === "string" ? Number(value) : value;
  const safe = Number.isFinite(amount) ? amount : 0;
  const prefix = safe >= 0 ? "+" : "-";
  return `${prefix}${formatDisplayMoney(Math.abs(safe), displayCurrency)}`;
}

/**
 * Central money formatter driven by an ISO currency code, showing the code next
 * to the amount to mirror the broker receipt ("$1,554.49 MXN", "$41.56 USD").
 */
export function formatMoneyInCurrency(value: string | number, currencyCode: string): string {
  const amount = typeof value === "string" ? Number(value) : value;
  const safe = Number.isFinite(amount) ? amount : 0;
  const code = (currencyCode || "USD").trim().toUpperCase();
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
  return `$${formatted} ${code}`;
}

/**
 * Short FX label for a tooltip (ADR-0010 action #3), e.g.
 * "MXN @ 17.51 · BANXICO · 2026-09-26". Returns null when no FX was applied
 * (USD, missing envelope, or unit rate), so callers can hide the tooltip.
 */
export function formatFxRateLabel(presentation?: PresentationEnvelope | null): string | null {
  if (!presentation) return null;
  const display = presentation.displayCurrency?.trim().toUpperCase();
  const base = presentation.baseCurrency?.trim().toUpperCase();
  if (!display || display === base) return null;
  if (!presentation.fxRate || presentation.fxRate === 1) return null;

  const parts = [`${display} @ ${presentation.fxRate.toFixed(2)}`];
  if (presentation.rateProvider) parts.push(presentation.rateProvider);
  if (presentation.rateAsOf) parts.push(presentation.rateAsOf.slice(0, 10));
  return parts.join(" · ");
}
