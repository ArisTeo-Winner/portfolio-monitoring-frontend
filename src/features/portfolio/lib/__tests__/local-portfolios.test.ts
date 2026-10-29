import { readPortfolioPreferences, savePortfolioPreference } from "../local-portfolios";
import type { PortfolioPreference } from "../local-portfolios";

const STORAGE_KEY = "cpm.portfolios";

function makePreference(overrides: Partial<PortfolioPreference> = {}): PortfolioPreference {
  return {
    assetType: "CRYPTO",
    label: "Crypto",
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("readPortfolioPreferences", () => {
  it("returns an empty array when localStorage has no entry", () => {
    expect(readPortfolioPreferences()).toEqual([]);
  });

  it("returns the stored preferences", () => {
    const prefs = [makePreference()];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    expect(readPortfolioPreferences()).toEqual(prefs);
  });

  it("returns an empty array for malformed JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not-json");
    expect(readPortfolioPreferences()).toEqual([]);
  });

  it("returns an empty array when the stored value is not an array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: "an array" }));
    expect(readPortfolioPreferences()).toEqual([]);
  });

  it("filters out entries missing assetType or label", () => {
    const invalid = [{ createdAt: "2024-01-01T00:00:00Z" }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invalid));
    expect(readPortfolioPreferences()).toEqual([]);
  });
});

describe("savePortfolioPreference", () => {
  it("persists a new preference to localStorage", () => {
    const pref = makePreference();
    savePortfolioPreference(pref);
    expect(readPortfolioPreferences()).toContainEqual(pref);
  });

  it("replaces an existing preference with the same assetType", () => {
    savePortfolioPreference(makePreference({ label: "Old label" }));
    savePortfolioPreference(makePreference({ label: "New label" }));

    const stored = readPortfolioPreferences();
    const entry = stored.find((p) => p.assetType === "CRYPTO");
    expect(entry?.label).toBe("New label");
    expect(stored).toHaveLength(1);
  });

  it("sorts entries by createdAt ascending", () => {
    savePortfolioPreference(makePreference({ assetType: "STOCK", createdAt: "2024-03-01T00:00:00Z" }));
    savePortfolioPreference(makePreference({ assetType: "CRYPTO", createdAt: "2024-01-01T00:00:00Z" }));

    const stored = readPortfolioPreferences();
    expect(stored[0].assetType).toBe("CRYPTO");
    expect(stored[1].assetType).toBe("STOCK");
  });

  it("can store multiple preferences with distinct assetTypes", () => {
    savePortfolioPreference(makePreference({ assetType: "CRYPTO" }));
    savePortfolioPreference(makePreference({ assetType: "STOCK" }));

    expect(readPortfolioPreferences()).toHaveLength(2);
  });
});
