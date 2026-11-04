"use client";

import { searchAssets } from "@/features/assets/api/search-assets";
import {
  getAssetLogoFromRegistry,
  getAssetNameFromRegistry,
  readAssetLogoRegistry,
  rememberAssetLogo,
  type AssetLogoRegistry,
} from "@/features/assets/lib/asset-logo-registry";
import {
  fetchCoinGeckoCryptoLogoMap,
  readCoinGeckoCryptoLogoMap,
} from "@/features/assets/lib/coingecko-crypto-logos";
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
        symbol &&
        (!getAssetLogoFromRegistry(registry, symbol, assetType) ||
          !getAssetNameFromRegistry(registry, symbol, assetType)),
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

  // Crypto whose catalog (searchAssets) carries no logo falls back to the
  // CoinGecko market map — the same source the live resolver uses — but here we
  // persist it into the shared registry so Portfolio resolves it on first lookup,
  // exactly like Transactions resolve the BFF inline logoUrl. This removes the
  // Portfolio-vs-Transactions icon divergence (e.g. BNB, which in prod resolves
  // only via CoinGecko) and survives reloads. Must not throw (background prefetch).
  try {
    const afterSearch = readAssetLogoRegistry();
    const cryptoMissing = missing.filter(
      ({ symbol, assetType }) =>
        normalizeAssetType(assetType, symbol) === "CRYPTO" &&
        !getAssetLogoFromRegistry(afterSearch, symbol, assetType),
    );

    if (cryptoMissing.length) {
      let cryptoMap = readCoinGeckoCryptoLogoMap();
      if (!Object.keys(cryptoMap).length) {
        cryptoMap = await fetchCoinGeckoCryptoLogoMap();
      }
      for (const { symbol, assetType } of cryptoMissing) {
        const logoUrl = cryptoMap[symbol.toUpperCase()];
        if (logoUrl) rememberAssetLogo({ symbol, assetType, logoUrl });
      }
    }
  } catch {
    // Provider unavailable — keep whatever searchAssets resolved; the live
    // resolver still falls back to CoinGecko at render time.
  }

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
