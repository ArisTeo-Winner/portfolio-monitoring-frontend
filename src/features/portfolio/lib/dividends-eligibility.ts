import type { DividendEligibilityStatus, NextDividend } from "@/features/market/types/dividend-growth.types";

// ADR-0025 F4 — turn the backend's persisted eligibility into what the UI shows.
// The front owns the label (es-MX) and the theme tone; the backend only sends the
// raw enum. A missing status (pre-deploy response) falls back to inferring from
// whether any dividend income was computed, preserving the old binary behavior.

export type DisplayDividendStatus = "pays" | "none" | "verifying";

export function resolveDividendStatus(
  eligibilityStatus: DividendEligibilityStatus | null | undefined,
  annualIncome: number,
): DisplayDividendStatus {
  switch (eligibilityStatus) {
    case "PAYS":
      return "pays";
    case "NONE":
      return "none";
    case "ERROR":
    case "UNKNOWN":
      // Not conclusive — the backend re-checks on a cadence. Never "no paga".
      return "verifying";
    default:
      // Field absent (backend not yet deployed): keep the legacy inference.
      return annualIncome > 0 ? "pays" : "none";
  }
}

export type DividendStatusBadge = {
  label: string;
  tone: "positive" | "neutral" | "pending";
};

export function dividendStatusBadge(status: DisplayDividendStatus): DividendStatusBadge {
  switch (status) {
    case "pays":
      return { label: "Paga dividendos", tone: "positive" };
    case "none":
      return { label: "No reparte dividendos", tone: "neutral" };
    case "verifying":
      return { label: "Verificando…", tone: "pending" };
  }
}

export function frequencyLabel(frequency: number | null | undefined): string | null {
  switch (frequency) {
    case 1:
      return "anual";
    case 2:
      return "semestral";
    case 4:
      return "trimestral";
    case 12:
      return "mensual";
    default:
      return null;
  }
}

// yyyy-MM-dd → "24 mar 2026" without any timezone shift (parse as a local date,
// not via Date(iso) which treats a bare date as UTC midnight).
export function formatDividendDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export type UpcomingDividend<T> = {
  item: T;
  nextDividend: NextDividend;
  keyDate: string; // the date we sort/compare on (payment date, else ex-date)
};

// Pick the holding whose next payment comes soonest. ISO yyyy-MM-dd sorts
// lexicographically, so no Date parsing is needed for the comparison. Anything
// strictly before `today` is treated as stale and dropped.
export function pickSoonestDividend<T extends { nextDividend?: NextDividend | null }>(
  items: T[],
  today: string,
): UpcomingDividend<T> | null {
  const upcoming = items
    .map((item) => {
      const nd = item.nextDividend;
      if (!nd) return null;
      const keyDate = nd.paymentDate ?? nd.exDividendDate;
      if (!keyDate) return null;
      return { item, nextDividend: nd, keyDate };
    })
    .filter((x): x is UpcomingDividend<T> => x != null && x.keyDate >= today)
    .sort((a, b) => a.keyDate.localeCompare(b.keyDate));
  return upcoming[0] ?? null;
}
