/**
 * Presentation-currency envelope (ADR-0010). The backend keeps storage and P&L
 * in base USD and converts money amounts to the user's `preferred_currency` at
 * the read edge, attaching this envelope so the frontend knows what currency the
 * numbers are already in (and can show the FX rate that was applied).
 *
 * The envelope is ADDITIVE: a pre-ADR-0010 backend omits it, and with
 * preferred_currency=USD it is a no-op (fxRate=1, provider/asOf null). Always
 * read it defensively via `resolveDisplayCurrency` so the UI works with both the
 * current and the new backend.
 */
export type PresentationEnvelope = {
  /** Always "USD" in v1 — the storage/valuation base. */
  baseCurrency: string;
  /** Currency the money fields are already expressed in (e.g. "USD", "MXN"). */
  displayCurrency: string;
  /** USD→display multiplier. 1 when displayCurrency === baseCurrency. */
  fxRate: number;
  /** FX source (e.g. "BANXICO"); null when no FX was applied (USD). */
  rateProvider: string | null;
  /** ISO timestamp of the rate; null when no FX was applied (USD). */
  rateAsOf: string | null;
};
