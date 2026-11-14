// ADR-0014 dividend growth (GET /market/dividends/{symbol}/growth, public).
//
// IMPORTANT: unlike totalReturnPercent, the CAGR values are FRACTIONS, not
// percents — 0.0734 means 7.34%. Any horizon can be null when there is not
// enough dividend history to compute it.
export type AnnualDividend = {
  year: number;
  totalDps: number; // total dividend per share paid that year
};

// ADR-0025 F4 persisted eligibility. Lets the UI distinguish an empty
// annualDividends that means "confirmed non-payer" (NONE) from one that means
// "not verified yet / provider error" (UNKNOWN/ERROR) — never inferred from the
// empty array. ERROR is NOT conclusive and must never render as "no paga".
export type DividendEligibilityStatus = "PAYS" | "NONE" | "ERROR" | "UNKNOWN";

// ADR-0025 F4-B "próximo pago" (Snowball-style), per holding. Dates are plain
// LocalDate (yyyy-MM-dd, no zone). currency MAY differ from the root currency
// (e.g. a BMV/MXN name) — treat it as this row's own currency, never summed.
export type NextDividend = {
  exDividendDate: string | null; // yyyy-MM-dd
  paymentDate: string | null; // yyyy-MM-dd
  amountPerShare: number;
  currency: string;
  frequency: number | null; // payments per year (4 = quarterly, 12 = monthly, 1 = annual)
};

// ADR-0031 cross-currency-safe dividend yield. The backend computes the trailing
// yield in the asset's NATIVE currency (last full year DPS, split-adjusted ÷
// current price fetched in that same currency), so the % is invariant to the
// user's preferredCurrency and never needs an FX conversion. priceBasis.currency
// ALWAYS matches the dividend currency and records which price was used.
export type DividendPriceBasis = {
  price: number;
  currency: string; // native currency of the asset (same as the dividend)
  asOf: string; // ISO-8601 with offset
};

export type DividendGrowthResponse = {
  symbol: string;
  annualDividends: AnnualDividend[]; // ascending by year
  cagr1y: number | null;
  cagr3y: number | null;
  cagr5y: number | null;
  cagr10y: number | null;
  // Native currency of totalDps (NOT converted to presentation currency; ≈USD for
  // US names). Optional: pending the backend adding it — used only to label DPS.
  currency?: string | null;
  // ADR-0025 F4 (additive, pending backend deploy — all optional so a pre-deploy
  // response still typechecks and the UI falls back to inferring from history).
  eligibilityStatus?: DividendEligibilityStatus | null;
  lastCheckedAt?: string | null; // ISO-8601 with offset, or null when UNKNOWN
  nextDividend?: NextDividend | null; // null = no announced upcoming payment
  // ADR-0031 (additive, pending backend deploy — optional). Trailing yield as a
  // FRACTION (0.036667 = 3.67%), cross-currency safe; null = no dividend history
  // or price unavailable. When undefined (pre-deploy backend), the UI falls back
  // to computing the yield locally (same-currency only). priceBasis is null
  // whenever yieldPct is null.
  yieldPct?: number | null;
  priceBasis?: DividendPriceBasis | null;
};
