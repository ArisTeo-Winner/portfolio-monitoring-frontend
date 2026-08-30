export type PortfolioPreference = {
  assetType: string;
  /** Kept for backward compat but no longer used as sidebar label. */
  label: string;
  createdAt: string;
  /** Emoji character used as avatar (e.g. "🟢", "💰"). Defaults to first letter of label. */
  avatar?: string;
  /** Whether to include this portfolio in the consolidated total value. Default: true. */
  countAsTotal?: boolean;
};

const STORAGE_KEY = "cpm.portfolios";
const DEFAULT_KEY = "cpm.defaultPortfolio";

export function readPortfolioPreferences(): PortfolioPreference[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PortfolioPreference[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.assetType === "string" && typeof item.label === "string");
  } catch {
    return [];
  }
}

export function savePortfolioPreference(preference: PortfolioPreference) {
  if (typeof window === "undefined") return;

  const current = readPortfolioPreferences();
  const next = [
    ...current.filter((item) => item.assetType !== preference.assetType),
    preference,
  ].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function removePortfolioPreference(assetType: string) {
  if (typeof window === "undefined") return;

  const current = readPortfolioPreferences();
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(current.filter((item) => item.assetType !== assetType)),
  );

  // Clear default if it was the removed one
  if (readDefaultPortfolio() === assetType) {
    window.localStorage.removeItem(DEFAULT_KEY);
  }
}

export function readDefaultPortfolio(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(DEFAULT_KEY);
}

export function saveDefaultPortfolio(assetType: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEFAULT_KEY, assetType);
}
