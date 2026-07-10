"use client";

import type { AssetOption } from "@/features/assets/types/asset.types";

const STORAGE_KEY = "asset-recent-selections";
const MAX_RECENT = 5;

export function getRecentAssets(): AssetOption[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as AssetOption[];
  } catch {
    return [];
  }
}

export function rememberRecentAsset(asset: AssetOption | null | undefined) {
  if (!asset?.symbol || typeof window === "undefined") return;

  const key = toKey(asset.symbol, asset.assetType);
  const existing = getRecentAssets().filter((item) => toKey(item.symbol, item.assetType) !== key);
  const next = [asset, ...existing].slice(0, MAX_RECENT);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures (e.g. private browsing quota).
  }
}

function toKey(symbol: string, assetType: string) {
  return `${assetType.trim().toUpperCase()}::${symbol.trim().toUpperCase()}`;
}
