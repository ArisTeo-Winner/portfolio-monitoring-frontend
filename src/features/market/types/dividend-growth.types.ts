// ADR-0014 dividend growth (GET /market/dividends/{symbol}/growth, public).
//
// IMPORTANT: unlike totalReturnPercent, the CAGR values are FRACTIONS, not
// percents — 0.0734 means 7.34%. Any horizon can be null when there is not
// enough dividend history to compute it.
export type AnnualDividend = {
  year: number;
  totalDps: number; // total dividend per share paid that year
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
};
