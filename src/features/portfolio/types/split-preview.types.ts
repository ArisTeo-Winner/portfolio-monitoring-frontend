// ADR-0011 stock splits — contract for POST /api/v1/me/portfolio/split-preview.
//
// Read-only equivalence calculator. It NEVER mutates anything: the transaction is
// always stored RAW (as captured from the broker receipt) and the backend adjusts
// in the read projection. This endpoint only tells the UI what the user WILL see
// so we can show an informational heads-up. Omitting quantity/pricePerUnit still
// returns detection (splitDetected + splits), with adjusted.* null.

export type SplitPreviewRequest = {
  symbol: string;
  /** ISO-8601 with offset (e.g. "2024-05-01T12:00:00Z"). */
  transactionDate: string;
  quantity?: number;
  pricePerUnit?: number;
};

export type SplitInfo = {
  /** Human ratio, e.g. "10-for-1" / "1-for-100"; falls back to "x<factor>". */
  ratio: string;
  /** "YYYY-MM-DD". */
  executionDate: string;
  /** split_to / split_from. Forward 10-for-1 → 10; reverse 1-for-100 → 0.01. */
  shareMultiplier: number;
};

export type SplitPreviewAmounts = {
  quantity: number | null;
  pricePerUnit: number | null;
};

/** FORWARD = normal split (factor > 1); REVERSE = reverse/consolidation (factor < 1). */
export type SplitType = "FORWARD" | "REVERSE";

export type SplitPreviewResponse = {
  splitDetected: boolean;
  /** FORWARD / REVERSE; null when no split. Drives retail-friendly styling. */
  splitType: SplitType | null;
  /** Accumulated shareMultiplier across all detected splits. */
  factor: number;
  splits: SplitInfo[];
  original: SplitPreviewAmounts;
  /** quantity × factor ; pricePerUnit ÷ factor. Total cost (qty×price) invariant. */
  adjusted: SplitPreviewAmounts;
  /** Pre-built Spanish copy from the backend; we build our own currency-aware copy. */
  note: string | null;
};
