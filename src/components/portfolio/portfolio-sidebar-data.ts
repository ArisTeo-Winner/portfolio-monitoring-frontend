import type { PortfolioPreference } from "@/features/portfolio/lib/local-portfolios";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";

export const PORTFOLIO_DEFINITIONS = [
  { assetType: "CRYPTO", label: "Crypto", description: "Tokens y monedas", color: "#10b981" },
  { assetType: "STOCK", label: "Stocks", description: "Acciones globales", color: "#3b82f6" },
  { assetType: "INDEX", label: "Indices", description: "Mercados base", color: "#f97316" },
  { assetType: "ETF", label: "ETFs", description: "Fondos cotizados", color: "#8b5cf6" },
] as const;

export type SidebarGroup = {
  assetType: string;
  label: string;
  description: string;
  color: string;
  totalValue: number;
  entryCount: number;
  changePercent: number;
  created: boolean;
};

function getAssetPalette(keyword: string) {
  const palettes = ["#f97316", "#14b8a6", "#6366f1", "#f43f5e", "#10b981", "#eab308"];
  const index = keyword.split("").reduce((acc, character) => acc + character.charCodeAt(0), 0) % palettes.length;
  return palettes[index];
}

export function buildSidebarGroups(entries: PortfolioEntry[], preferences: PortfolioPreference[]) {
  const groups: SidebarGroup[] = [];
  const activeEntries = entries.filter((entry) => Number(entry.totalQuantity) > 0 || Number(entry.totalInvested) > 0);
  const discoveredAssetTypes = new Set(activeEntries.map((entry) => entry.assetType));

  discoveredAssetTypes.forEach((assetType) => {
    const portfolioEntries = activeEntries.filter((entry) => entry.assetType === assetType);
    const preference = preferences.find((item) => item.assetType === assetType);
    const predefined = PORTFOLIO_DEFINITIONS.find((definition) => definition.assetType === assetType);
    const totalValue = portfolioEntries.reduce((acc, entry) => acc + Number(entry.currentValue), 0);
    const totalInvested = portfolioEntries.reduce((acc, entry) => acc + Number(entry.totalInvested), 0);
    const totalProfitLoss = portfolioEntries.reduce((acc, entry) => acc + Number(entry.totalProfitLoss), 0);
    const changePercent = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

    groups.push({
      assetType,
      label: preference?.label ?? predefined?.label ?? (assetType.charAt(0).toUpperCase() + assetType.slice(1).toLowerCase()),
      description: predefined?.description ?? "User asset",
      color: predefined?.color ?? getAssetPalette(assetType),
      totalValue,
      entryCount: portfolioEntries.length,
      changePercent,
      created: Boolean(preference),
    });
  });

  groups.sort((left, right) => {
    const leftIndex = PORTFOLIO_DEFINITIONS.findIndex((definition) => definition.assetType === left.assetType);
    const rightIndex = PORTFOLIO_DEFINITIONS.findIndex((definition) => definition.assetType === right.assetType);
    if (leftIndex !== -1 && rightIndex !== -1) return leftIndex - rightIndex;
    if (leftIndex !== -1) return -1;
    if (rightIndex !== -1) return 1;
    return left.label.localeCompare(right.label);
  });

  return groups;
}
