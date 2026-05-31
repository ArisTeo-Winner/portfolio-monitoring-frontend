/**
 * Global portfolio store — single source of truth for sidebar, overview and modal.
 * Hydrated by PortfolioPageContent after each API fetch via syncFromEntries().
 */
import { create } from "zustand";
import { buildSidebarGroups } from "@/components/portfolio/portfolio-sidebar-data";
import type { SidebarGroup } from "@/components/portfolio/portfolio-sidebar-data";
import {
  readPortfolioPreferences,
  savePortfolioPreference,
  removePortfolioPreference,
  saveDefaultPortfolio,
  readDefaultPortfolio,
} from "@/features/portfolio/lib/local-portfolios";
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
  /** Update name/avatar/toggle for an existing portfolio preference. */
  editPortfolio: (preference: PortfolioPreference) => void;
  /** Remove a portfolio preference from localStorage and rebuild sidebar. */
  removePortfolio: (assetType: string) => void;
  /** Mark an assetType as the default portfolio. */
  setDefaultPortfolio: (assetType: string) => void;
  /** Currently persisted default assetType (null = none set). */
  defaultPortfolio: string | null;
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
  groups: [],
  selectedType: "",
  totalValue: 0,
  entries: [],
  defaultPortfolio: readDefaultPortfolio(),

  setSelectedType: (type) => set({ selectedType: type }),

  syncFromEntries: (entries) => {
    const preferences = readPortfolioPreferences();
    const groups = buildSidebarGroups(entries, preferences);
    const totalValue = entries.reduce((acc, e) => acc + Number(e.currentValue), 0);
    set({ entries, groups, totalValue, defaultPortfolio: readDefaultPortfolio() });
  },

  addPortfolio: (preference) => {
    savePortfolioPreference(preference);
    const preferences = readPortfolioPreferences();
    const groups = buildSidebarGroups(get().entries, preferences);
    set({ groups });
  },

  editPortfolio: (preference) => {
    savePortfolioPreference(preference);
    const preferences = readPortfolioPreferences();
    const groups = buildSidebarGroups(get().entries, preferences);
    set({ groups });
  },

  removePortfolio: (assetType) => {
    removePortfolioPreference(assetType);
    const preferences = readPortfolioPreferences();
    const groups = buildSidebarGroups(get().entries, preferences);
    const defaultPortfolio = readDefaultPortfolio();
    set({ groups, defaultPortfolio });
  },

  setDefaultPortfolio: (assetType) => {
    saveDefaultPortfolio(assetType);
    set({ defaultPortfolio: assetType });
  },
}));

// ─── Convenience selectors ────────────────────────────────────────────────────

export const selectGroups = (s: PortfolioStore) => s.groups;
export const selectTotalValue = (s: PortfolioStore) => s.totalValue;
export const selectSelectedType = (s: PortfolioStore) => s.selectedType;
export const selectEntries = (s: PortfolioStore) => s.entries;
