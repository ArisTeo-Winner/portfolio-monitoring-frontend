/**
 * Global portfolio store — single source of truth for sidebar, overview and modal.
 * Hydrated by PortfolioPageContent after each API fetch via syncFromEntries().
 */
import { create } from "zustand";
import { buildSidebarGroups } from "@/components/portfolio/portfolio-sidebar-data";
import type { SidebarGroup } from "@/components/portfolio/portfolio-sidebar-data";
import { readPortfolioPreferences, savePortfolioPreference } from "@/features/portfolio/lib/local-portfolios";
import type { PortfolioPreference } from "@/features/portfolio/lib/local-portfolios";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type { SidebarGroup };

type PortfolioStore = {
  // Derived view-model for the sidebar
  groups: SidebarGroup[];
  // Currently selected asset-type filter ("" = overview)
  selectedType: string;
  // Sum of currentValue across all entries
  totalValue: number;
  // Raw entries kept for downstream consumers
  entries: PortfolioEntry[];

  // Actions
  setSelectedType: (type: string) => void;
  /**
   * Called after every successful GET /me/portfolio response.
   * Rebuilds groups + totalValue and re-reads localStorage preferences.
   */
  syncFromEntries: (entries: PortfolioEntry[]) => void;
  /**
   * Optimistically appends a new portfolio preference to localStorage
   * and rebuilds the sidebar groups without waiting for an API round-trip.
   */
  addPortfolio: (preference: PortfolioPreference) => void;
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
  groups: [],
  selectedType: "",
  totalValue: 0,
  entries: [],

  setSelectedType: (type) => set({ selectedType: type }),

  syncFromEntries: (entries) => {
    const preferences = readPortfolioPreferences();
    const groups = buildSidebarGroups(entries, preferences);
    const totalValue = entries.reduce((acc, e) => acc + Number(e.currentValue), 0);
    set({ entries, groups, totalValue });
  },

  addPortfolio: (preference) => {
    savePortfolioPreference(preference);
    // Rebuild sidebar immediately with the entries already in store
    const preferences = readPortfolioPreferences();
    const groups = buildSidebarGroups(get().entries, preferences);
    set({ groups });
  },
}));

// ─── Convenience selectors ────────────────────────────────────────────────────

export const selectGroups = (s: PortfolioStore) => s.groups;
export const selectTotalValue = (s: PortfolioStore) => s.totalValue;
export const selectSelectedType = (s: PortfolioStore) => s.selectedType;
export const selectEntries = (s: PortfolioStore) => s.entries;
