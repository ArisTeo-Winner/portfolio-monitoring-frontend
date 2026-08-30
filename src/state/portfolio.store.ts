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
import { getUsdMxnRateCached } from "@/features/marketdata/api/get-usd-mxn-rate";
import { computePortfolioTotals, type PortfolioCurrencyTotals } from "@/lib/utils/currency";

// ─── Types ────────────────────────────────────────────────────────────────────

export type { SidebarGroup };

type PortfolioStore = {
  // Derived view-model for the sidebar
  groups: SidebarGroup[];
  // Currently selected asset-type filter ("" = overview)
  selectedType: string;
  // USD-equivalent grand total (MXN positions converted via the live FX rate).
  // Falls back to `totals.totalUsd` (the USD-only subtotal) if the rate is
  // unavailable — see `totals` for the full currency breakdown.
  totalValue: number;
  // Currency-aware breakdown backing `totalValue` — use this to render the
  // total instead of re-summing entries, so USD and MXN never get mixed.
  totals: PortfolioCurrencyTotals;
  // Raw entries kept for downstream consumers
  entries: PortfolioEntry[];

  // Actions
  setSelectedType: (type: string) => void;
  /**
   * Called after every successful GET /me/portfolio response.
   * Rebuilds groups + totals (fetching the USD/MXN rate) and re-reads
   * localStorage preferences.
   */
  syncFromEntries: (entries: PortfolioEntry[]) => Promise<void>;
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
  totals: { combined: false, totalUsd: 0, totalMxn: 0 },
  entries: [],
  defaultPortfolio: readDefaultPortfolio(),

  setSelectedType: (type) => set({ selectedType: type }),

  syncFromEntries: async (entries) => {
    const preferences = readPortfolioPreferences();
    const groups = buildSidebarGroups(entries, preferences);
    const usdMxnRate = await getUsdMxnRateCached()
      .then((fx) => fx.rate)
      .catch(() => null);
    const totals = computePortfolioTotals(entries, usdMxnRate);
    set({ entries, groups, totalValue: totals.totalUsd, totals, defaultPortfolio: readDefaultPortfolio() });
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
export const selectPortfolioTotals = (s: PortfolioStore) => s.totals;
export const selectTotalValue = (s: PortfolioStore) => s.totalValue;
export const selectSelectedType = (s: PortfolioStore) => s.selectedType;
export const selectEntries = (s: PortfolioStore) => s.entries;
