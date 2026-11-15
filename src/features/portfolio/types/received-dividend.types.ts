// ADR-0029 "Mis Dividendos" — GET /api/v1/me/dividends. The authenticated user's
// RECEIVED dividends, each with their own amounts (gross/tax/net), ordered by
// paymentDate descending. Only payments already received (paymentDate <= today);
// future payments live in the /growth "próximo pago" summary instead.
export type ReceivedDividendType = "CASH" | "STOCK";

export type ReceivedDividend = {
  symbol: string;
  assetName: string | null; // from catalog; may be null if unresolved
  logoUrl: string | null; // from catalog; may be null
  exDate: string | null; // LocalDate yyyy-MM-dd, or null
  paymentDate: string; // ISO-8601 OffsetDateTime
  // shares and amountPerShare come back null for dividends credited before the
  // ADR-0029 migration (not yet denormalized) → render "—" for those two.
  shares: number | null;
  amountPerShare: number | null;
  grossAmount: number; // gross received
  taxWithheld: number; // withholding
  netAmount: number; // = gross - tax (already computed by the backend; do not recompute)
  type: ReceivedDividendType; // CASH | STOCK (frequency/special arrive in v2)
  currency: string; // per-row; never summed across currencies (ADR-0010)
};
