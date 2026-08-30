"use client";

import { searchAssets } from "@/features/assets/api/search-assets";
import {
  getAssetLogoFromRegistry,
  readAssetLogoRegistry,
  rememberAssetLogo,
  type AssetLogoRegistry,
} from "@/features/assets/lib/asset-logo-registry";
import { normalizeAssetType } from "@/lib/utils/asset";

type AssetRef = { symbol: string; assetType: string };

/**
 * Fetches and caches logos for any assets not already in the registry.
 * Runs in background — does not throw. Returns the updated registry.
 * Concurrency is capped at BATCH_SIZE to avoid request floods.
 */
export async function prefetchAssetLogos(
  assets: AssetRef[],
): Promise<AssetLogoRegistry> {
  if (typeof window === "undefined") return {};

  const registry = readAssetLogoRegistry();

  const missing = deduplicateBySymbol(
    assets.filter(
      ({ symbol, assetType }) =>
        symbol && !getAssetLogoFromRegistry(registry, symbol, assetType),
    ),
  );

  if (!missing.length) return registry;

  await runInBatches(missing, 4, async ({ symbol, assetType }) => {
    const results = await searchAssets(symbol, 3);
    const match =
      results.find(
        (r) =>
          r.symbol.toUpperCase() === symbol.toUpperCase() &&
          normalizeAssetType(r.assetType) === normalizeAssetType(assetType),
      ) ?? results.find((r) => r.symbol.toUpperCase() === symbol.toUpperCase());

    if (match?.logoUrl) {
      rememberAssetLogo(match);
    }
  });

  return readAssetLogoRegistry();
}

function deduplicateBySymbol(assets: AssetRef[]): AssetRef[] {
  const seen = new Set<string>();
  return assets.filter(({ symbol }) => {
    const key = symbol.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function runInBatches<T>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.allSettled(items.slice(i, i + concurrency).map(task));
  }
}
