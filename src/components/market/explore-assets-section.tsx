"use client";

import { useEffect, useState } from "react";
import { CetesCurveWidget } from "@/components/cetes/CetesCurveWidget";
import { AssetAvatar } from "@/components/shared/AssetAvatar";
import { getAssetsByType } from "@/features/assets/api/get-assets-by-type";
import type { AssetOption } from "@/features/assets/types/asset.types";
import { ApiError } from "@/lib/api/problem-details";

const EXPLORE_CATEGORIES = [
  { type: "STOCK", label: "Acciones" },
  { type: "ETF", label: "ETFs" },
  { type: "CRYPTO", label: "Cripto" },
  { type: "GOVERNMENT_BOND", label: "Bonos Gobierno" },
] as const;

type ExploreCategory = (typeof EXPLORE_CATEGORIES)[number]["type"];

// Full catalog per type (not just the top N in /popular) — lets users browse
// every tradeable asset in a category, including query-only INDEX entries.
export function ExploreAssetsSection({ onSelectAsset }: { onSelectAsset: (asset: AssetOption) => void }) {
  const [category, setCategory] = useState<ExploreCategory>("STOCK");
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getAssetsByType(category, 200)
      .then((data) => {
        if (active) setAssets(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError ? err.message : "No fue posible cargar los activos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [category]);

  return (
    <div className="space-y-5">
      {category === "GOVERNMENT_BOND" ? <CetesCurveWidget /> : null}

      <section className="overflow-hidden rounded-[1.35rem] bg-[#111317] shadow-[0_24px_60px_rgba(0,0,0,0.28)] ring-1 ring-[#191d24]/90">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#181b21] bg-[#0f1217]/85 px-5 py-4">
          {EXPLORE_CATEGORIES.map((cat) => (
            <button
              className={`rounded-[0.78rem] px-4 py-2.5 text-[0.82rem] font-semibold transition ${
                category === cat.type
                  ? "bg-[#171c24] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                  : "text-[#8f99ab] hover:text-white"
              }`}
              key={cat.type}
              onClick={() => setCategory(cat.type)}
              type="button"
            >
              {cat.label}
            </button>
          ))}
        </div>

        {loading ? <div className="px-5 py-12 text-center text-[#7c8799]">Cargando activos...</div> : null}
        {!loading && error ? <div className="px-5 py-12 text-center text-[#ff7e8a]">{error}</div> : null}
        {!loading && !error && !assets.length ? (
          <div className="px-5 py-12 text-center text-[#7c8799]">No hay activos disponibles en esta categoria.</div>
        ) : null}

        {!loading && !error && assets.length ? (
          <div className="divide-y divide-[#181b21]">
            {assets.map((asset) => {
              const disabled = !asset.supportedForTransactions;
              return (
                <button
                  className={`flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition ${
                    disabled ? "cursor-not-allowed opacity-50" : "hover:bg-[#13171d]"
                  }`}
                  disabled={disabled}
                  key={`${asset.assetType}-${asset.symbol}`}
                  onClick={() => onSelectAsset(asset)}
                  title={disabled ? "Solo consulta, no transaccionable" : undefined}
                  type="button"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <AssetAvatar assetType={asset.assetType} logoUrl={asset.logoUrl} size="lg" symbol={asset.symbol} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[1rem] font-semibold text-[#f4f7fb]">{asset.name}</span>
                        <span className="rounded-[0.45rem] bg-[#171b22] px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[#8d9ab0]">
                          {asset.symbol}
                        </span>
                      </div>
                      {disabled ? (
                        <p className="mt-0.5 text-[0.76rem] text-[#6f7a8f]">Solo consulta, no transaccionable</p>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-[0.45rem] bg-[#171b22] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#9daccc]">
                    {asset.assetType}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
