"use client";

import type { AssetOption } from "@/features/assets/types/asset.types";

const STORAGE_KEY = "asset-logo-registry";

export type AssetLogoRegistry = Record<string, string>;

export function readAssetLogoRegistry(): AssetLogoRegistry {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as AssetLogoRegistry;
  } catch {
    return {};
  }
}

export function rememberAssetLogo(asset: Pick<AssetOption, "symbol" | "assetType" | "logoUrl"> | null | undefined) {
  if (!asset?.symbol || !asset?.logoUrl || typeof window === "undefined") return;

  const registry = readAssetLogoRegistry();
  registry[toKey(asset.symbol, asset.assetType)] = asset.logoUrl;
  registry[toSymbolKey(asset.symbol)] = asset.logoUrl;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
}

export function getAssetLogoFromRegistry(
  registry: AssetLogoRegistry,
  symbol: string,
  assetType?: string | null,
) {
  if (!symbol) return null;
  return registry[toKey(symbol, assetType)] ?? registry[toSymbolKey(symbol)] ?? null;
}

function toKey(symbol: string, assetType?: string | null) {
  return `${normalize(assetType) || "UNKNOWN"}::${normalize(symbol)}`;
}

function toSymbolKey(symbol: string) {
  return `SYMBOL::${normalize(symbol)}`;
}

function normalize(value?: string | null) {
  return value?.trim().toUpperCase() ?? "";
}
