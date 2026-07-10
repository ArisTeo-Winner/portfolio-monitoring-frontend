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
