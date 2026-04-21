export type PortfolioPreference = {
  assetType: string;
  label: string;
  createdAt: string;
};

const STORAGE_KEY = "cpm.portfolios";

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
