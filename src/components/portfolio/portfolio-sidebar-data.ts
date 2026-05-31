import type { PortfolioPreference } from "@/features/portfolio/lib/local-portfolios";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";
import { getAssetPalette } from "@/lib/utils/asset";

/**
 * Color palette per canonical assetType — UI only, not data.
 * Labels come exclusively from the backend assetType field.
 */
const ASSET_TYPE_COLORS: Record<string, string> = {
  CRYPTO:    "#10b981",
  STOCK:     "#3b82f6",
  INDEX:     "#f97316",
  ETF:       "#8b5cf6",
  FUTURES:   "#eab308",
  FOREX:     "#06b6d4",
  GOV_BOND:  "#64748b",
  CORP_BOND: "#a78bfa",
  ECONOMY:   "#ec4899",
};

export type SidebarGroup = {
  assetType: string;
  label: string;
  color: string;
  totalValue: number;
  entryCount: number;
  changePercent: number;
  created: boolean;
  avatar?: string;
  countAsTotal: boolean;
};

/**
 * Normalize backend assetType variants to a canonical value.
 * e.g. "STOCKS" → "STOCK", "FX" → "FOREX"
 */
function normalizeAssetType(assetType: string): string {
  const upper = assetType.toUpperCase().replace(/[-\s]/g, "_");
  const map: Record<string, string> = {
    CRYPTOCURRENCY: "CRYPTO", COIN: "CRYPTO", TOKEN: "CRYPTO",
    STOCKS: "STOCK", EQUITY: "STOCK", EQUITIES: "STOCK", SHARE: "STOCK", SHARES: "STOCK",
    INDICES: "INDEX", INDICE: "INDEX",
    ETFS: "ETF",
    FUTURE: "FUTURES", CONTRATO: "FUTURES",
    FX: "FOREX", CURRENCY: "FOREX", CURRENCIES: "FOREX",
    GOVERNMENT_BOND: "GOV_BOND", PUBLIC_BOND: "GOV_BOND", SOVEREIGN: "GOV_BOND", TREASURY: "GOV_BOND",
    CORPORATE_BOND: "CORP_BOND", CORPORATE: "CORP_BOND",
    MACRO: "ECONOMY", INDICATOR: "ECONOMY",
  };
  return map[upper] ?? upper;
}

/**
 * Format a canonical assetType into a human-readable label.
 * "STOCK" → "Stock" | "GOV_BOND" → "Gov Bond" | "CRYPTO" → "Crypto"
 */
function formatAssetTypeLabel(assetType: string): string {
  return assetType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function buildSidebarGroups(entries: PortfolioEntry[], preferences: PortfolioPreference[]) {
  const groups: SidebarGroup[] = [];

  // Normalize assetType so variants like "STOCKS" merge with "STOCK"
  const activeEntries = entries
    .filter((entry) => Number(entry.totalQuantity) > 0 || Number(entry.totalInvested) > 0)
    .map((entry) => ({ ...entry, assetType: normalizeAssetType(entry.assetType) }));

  const discoveredAssetTypes = new Set(activeEntries.map((entry) => entry.assetType));

  discoveredAssetTypes.forEach((assetType) => {
    const portfolioEntries = activeEntries.filter((entry) => entry.assetType === assetType);
    const preference = preferences.find((item) => item.assetType === assetType);
    const totalValue = portfolioEntries.reduce((acc, entry) => acc + Number(entry.currentValue), 0);
    const totalInvested = portfolioEntries.reduce((acc, entry) => acc + Number(entry.totalInvested), 0);
    const totalProfitLoss = portfolioEntries.reduce((acc, entry) => acc + Number(entry.totalProfitLoss), 0);
    const changePercent = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

    groups.push({
      assetType,
      // Label derived from backend assetType — no static mapping
      label: formatAssetTypeLabel(assetType),
      color: ASSET_TYPE_COLORS[assetType] ?? getAssetPalette(assetType).base,
      totalValue,
      entryCount: portfolioEntries.length,
      changePercent,
      created: Boolean(preference),
      avatar: preference?.avatar,
      countAsTotal: preference?.countAsTotal ?? true,
    });
  });

  // Sort by known color order first, then alphabetically
  const ORDER = Object.keys(ASSET_TYPE_COLORS);
  groups.sort((a, b) => {
    const ai = ORDER.indexOf(a.assetType);
    const bi = ORDER.indexOf(b.assetType);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.label.localeCompare(b.label);
  });

  return groups;
}
