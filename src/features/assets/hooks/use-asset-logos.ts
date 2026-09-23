"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getAssetLogoFromRegistry,
  readAssetLogoRegistry,
  type AssetLogoRegistry,
} from "@/features/assets/lib/asset-logo-registry";
import { prefetchAssetLogos } from "@/features/assets/lib/logo-prefetcher";
import {
  fetchCoinGeckoCryptoLogoMap,
  readCoinGeckoCryptoLogoMap,
} from "@/features/assets/lib/coingecko-crypto-logos";
import { normalizeAssetType } from "@/lib/utils/asset";

export type AssetRef = { symbol: string; assetType: string };

/**
 * Single self-healing logo resolver shared by every asset list (portfolio,
 * transactions, …). It never needs manual catalog edits: when a logo is
 * missing it is resolved live from the providers already wired into the app
 * and cached, so a symbol that has no icon today (e.g. a newly listed coin)
 * gets one automatically on the next render without any code change.
 *
 * Resolution order for a given asset:
 *   1. inline URL the API already sent. For transactions this is the crypto
 *      logo the /api/me/transactions BFF resolved server-side, so it is trusted
 *      first; for other lists it is whatever the endpoint provides.
 *   2. local logo registry (searchAssets-backed, shared with the rest of the UI).
 *   3. CoinGecko market map — last-resort fallback for CRYPTO whose logo the
 *      endpoint did not carry (e.g. the portfolio endpoint sends no logoUrl).
 *   4. null → AssetAvatar falls back to initials / type icon.
 *
 * Both providers are refreshed in the background (registry via searchAssets,
 * CoinGecko via its 24h-cached same-origin proxy), so the maps self-heal over
 * time and the result is memoised to keep row rendering cheap.
 */
export function useAssetLogos(assets: AssetRef[]): (
  symbol: string,
  assetType?: string | null,
  inlineLogoUrl?: string | null,
) => string | null {
  const [registry, setRegistry] = useState<AssetLogoRegistry>({});
  const [cryptoMap, setCryptoMap] = useState<Record<string, string>>({});

  // Stable identity for the effect: only the distinct symbol+type set matters,
  // not the array reference (which changes on every parent render).
  const assetsKey = useMemo(
    () =>
      Array.from(
        new Set(assets.filter((a) => a.symbol).map((a) => `${a.symbol.toUpperCase()}:${a.assetType}`)),
      )
        .sort()
        .join("|"),
    [assets],
  );

  useEffect(() => {
    setRegistry(readAssetLogoRegistry());
    setCryptoMap(readCoinGeckoCryptoLogoMap());

    const refs = assets.filter((a) => a.symbol);
    if (!refs.length) return;

    void prefetchAssetLogos(refs).then(setRegistry);

    // Only pay the CoinGecko round-trip when a crypto asset is present.
    const hasCrypto = refs.some((a) => normalizeAssetType(a.assetType, a.symbol) === "CRYPTO");
    if (hasCrypto) {
      void fetchCoinGeckoCryptoLogoMap()
        .then(setCryptoMap)
        .catch(() => {
          /* provider unavailable — keep whatever is cached, fall back to initials */
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetsKey]);

  return useMemo(() => {
    return function resolveLogo(
      symbol: string,
      assetType?: string | null,
      inlineLogoUrl?: string | null,
    ): string | null {
      if (inlineLogoUrl) return inlineLogoUrl;
      if (!symbol) return null;

      const fromRegistry = getAssetLogoFromRegistry(registry, symbol, assetType);
      if (fromRegistry) return fromRegistry;

      // Last-resort for crypto whose endpoint sent no logoUrl (e.g. portfolio).
      if (normalizeAssetType(assetType ?? "", symbol) === "CRYPTO") {
        const fromCoinGecko = cryptoMap[symbol.toUpperCase()];
        if (fromCoinGecko) return fromCoinGecko;
      }

      return null;
    };
  }, [registry, cryptoMap]);
}
