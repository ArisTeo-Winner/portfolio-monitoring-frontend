"use client";

import type { AssetOption } from "@/features/assets/types/asset.types";

const STORAGE_KEY = "asset-logo-registry";

export type AssetLogoEntry = { logoUrl: string; name?: string };
// Registry value is AssetLogoEntry; legacy entries may still be plain strings.
export type AssetLogoRegistry = Record<string, AssetLogoEntry | string>;

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

export function rememberAssetLogo(
  asset: Pick<AssetOption, "symbol" | "assetType" | "logoUrl" | "name"> | null | undefined,
) {
  if (!asset?.symbol || !asset?.logoUrl || typeof window === "undefined") return;

  const registry = readAssetLogoRegistry();
  const entry: AssetLogoEntry = { logoUrl: asset.logoUrl, ...(asset.name ? { name: asset.name } : {}) };
  registry[toKey(asset.symbol, asset.assetType)] = entry;
  registry[toSymbolKey(asset.symbol)] = entry;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
}

export function getAssetLogoFromRegistry(
  registry: AssetLogoRegistry,
  symbol: string,
  assetType?: string | null,
): string | null {
  if (!symbol) return null;
  const raw = registry[toKey(symbol, assetType)] ?? registry[toSymbolKey(symbol)] ?? null;
  return raw ? entryLogoUrl(raw) : null;
}

export function getAssetNameFromRegistry(
  registry: AssetLogoRegistry,
  symbol: string,
  assetType?: string | null,
): string | null {
  if (!symbol) return null;
  const raw = registry[toKey(symbol, assetType)] ?? registry[toSymbolKey(symbol)] ?? null;
  if (!raw || typeof raw === "string") return null;
  return raw.name ?? null;
}

/**
 * Resolves the best display name for an asset.
 * Priority: registry name → fallback map → symbol.
 */
export function resolveAssetName(
  symbol: string,
  assetType?: string | null,
  registry?: AssetLogoRegistry,
): string {
  if (registry) {
    const name = getAssetNameFromRegistry(registry, symbol, assetType);
    if (name) return name;
  }
  // Inline fallback — kept minimal; registry is the source of truth for new assets.
  const FALLBACK: Record<string, string> = {
    BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", BNB: "BNB", XRP: "XRP",
    USDT: "Tether", USDC: "USD Coin", ADA: "Cardano", DOGE: "Dogecoin", PEPE: "Pepe",
    AAPL: "Apple Inc.", MSFT: "Microsoft Corp.", GOOGL: "Alphabet Inc.",
    GOOG: "Alphabet Inc. (C)", NVDA: "NVIDIA Corp", AMZN: "Amazon", TSLA: "Tesla",
    SPY: "SPDR S&P 500 ETF", QQQ: "Invesco QQQ Trust", META: "Meta Platforms",
    HYPE: "Hyperliquid", CRCL: "Circle Internet Group",
  };
  return FALLBACK[symbol.toUpperCase()] ?? symbol.toUpperCase();
}

function entryLogoUrl(raw: AssetLogoEntry | string): string {
  return typeof raw === "string" ? raw : raw.logoUrl;
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
