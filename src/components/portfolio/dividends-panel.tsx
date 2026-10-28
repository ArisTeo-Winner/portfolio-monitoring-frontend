"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { getDividendGrowth } from "@/features/market/api/get-dividend-growth";
import type { DividendGrowthResponse } from "@/features/market/types/dividend-growth.types";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";
import { getAssetLogoFromRegistry, readAssetLogoRegistry, resolveAssetName } from "@/features/assets/lib/asset-logo-registry";
import { AssetAvatar } from "@/components/shared/AssetAvatar";

type ViewMode = "zen" | "detail";

type Row = {
  entry: PortfolioEntry;
  name: string;
  logoUrl: string | null;
  shares: number;
  annualIncome: number; // DPS of the latest year × shares, in the dividend's native currency
  currency: string; // native currency of the dividend (NOT the presentation currency)
  cagr5y: number | null; // fraction
  pays: boolean;
};

// ADR-0014 Dividends tab — "Ingresos". Zen mode answers "how much do I get and
// when"; Detallado reveals the analyst columns. Income/growth come from the public
// dividend-growth endpoint (DPS is in the dividend's NATIVE currency, labeled as
// such). "Próximo pago" and yield-in-your-currency need a backend dividend
// calendar + presentation-currency aggregate, so they render as "Pendiente".
export function DividendsPanel({ entries }: { entries: PortfolioEntry[] }) {
  const [mode, setMode] = useState<ViewMode>("zen");

  const results = useQueries({
    queries: entries.map((entry) => ({
      queryKey: ["dividend-growth", entry.assetSymbol],
      queryFn: ({ signal }: { signal: AbortSignal }) => getDividendGrowth(entry.assetSymbol, signal),
      staleTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  });

  const loading = results.some((r) => r.isLoading);
  const [registry] = useState(() => readAssetLogoRegistry());

  const rows = useMemo<Row[]>(() => {
    return entries.map((entry, index) => {
      const data = results[index]?.data as DividendGrowthResponse | undefined;
      const years = [...(data?.annualDividends ?? [])].sort((a, b) => a.year - b.year);
      const latestDps = years.at(-1)?.totalDps ?? 0;
      const shares = Number(entry.totalQuantity) || 0;
      const annualIncome = latestDps * shares;
      return {
        entry,
        name: resolveAssetName(entry.assetSymbol, entry.assetType, registry),
        logoUrl: getAssetLogoFromRegistry(registry, entry.assetSymbol, entry.assetType) ?? null,
        shares,
        annualIncome,
        currency: data?.currency ?? "USD",
        cagr5y: data?.cagr5y ?? null,
        pays: annualIncome > 0,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- results identity changes each render; gate on the stable loading flag + entries instead.
  }, [entries, loading, registry]);

  const payers = rows.filter((r) => r.pays).sort((a, b) => b.annualIncome - a.annualIncome);
  const nonPayers = rows.filter((r) => !r.pays);

  // Group the annual income by native currency (never sum across currencies).
  const totalsByCurrency = useMemo(() => {
    const map = new Map<string, number>();
    payers.forEach((r) => map.set(r.currency, (map.get(r.currency) ?? 0) + r.annualIncome));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [payers]);

  const primaryTotal = totalsByCurrency[0] ?? null;
  const maxIncome = payers.reduce((m, r) => Math.max(m, r.annualIncome), 0);

  if (loading) {
    return <p className="px-2 py-10 text-center text-[0.9rem] text-[#7f8aa3]">Cargando tus dividendos…</p>;
  }

  if (!payers.length && !nonPayers.length) {
    return <p className="px-2 py-10 text-center text-[0.9rem] text-[#7f8aa3]">Aún no hay activos para analizar dividendos.</p>;
  }

  return (
    <div data-testid="portfolio-dividends">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.86rem] text-[#7f8aa3]">
          {mode === "zen"
            ? "El dinero que tus inversiones te pagan — sin tecnicismos."
            : "Vista completa: dividendo anual, crecimiento y fechas, estilo analista."}
        </p>
        <div className="inline-flex shrink-0 rounded-[0.8rem] border border-[#1b2028] bg-[#0f1217] p-0.5">
          <ModeTab active={mode === "zen"} label="Zen" onClick={() => setMode("zen")} />
          <ModeTab active={mode === "detail"} label="Detallado" onClick={() => setMode("detail")} />
        </div>
      </div>

      {mode === "zen" ? (
        <ZenView
          nonPayers={nonPayers}
          payers={payers}
          primaryTotal={primaryTotal}
          totalsByCurrency={totalsByCurrency}
          maxIncome={maxIncome}
        />
      ) : (
        <DetailView rows={rows} />
      )}
    </div>
  );
}

function ZenView({
  payers,
  nonPayers,
  primaryTotal,
  totalsByCurrency,
  maxIncome,
}: {
  payers: Row[];
  nonPayers: Row[];
  primaryTotal: [string, number] | null;
  totalsByCurrency: [string, number][];
  maxIncome: number;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
        <article className="rounded-[1.3rem] border border-[#232c3a] bg-[linear-gradient(165deg,rgba(31,211,139,0.10),#111317_55%)] p-5">
          <p className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-[#71819b]">Ingreso anual estimado</p>
          {primaryTotal ? (
            <>
              <p className="mt-2 text-[2rem] font-semibold tracking-[-0.03em] tabular-nums text-white md:text-[2.4rem]">
                {money(primaryTotal[1])} <span className="text-[0.44em] font-semibold text-[#7f8aa3]">{primaryTotal[0]}/año</span>
              </p>
              <p className="mt-2 text-[0.86rem] text-[#7f8aa3]">
                ≈ <b className="font-semibold tabular-nums text-white">{money(primaryTotal[1] / 12)}</b> cada mes, sin mover un dedo
              </p>
              {totalsByCurrency.length > 1 ? (
                <p className="mt-1 text-[0.74rem] text-[#5f6d82]">
                  + {totalsByCurrency.slice(1).map(([c, v]) => `${money(v)} ${c}`).join(" · ")} en otras monedas
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-[0.95rem] text-[#7f8aa3]">Tus activos todavía no reparten dividendos.</p>
          )}
        </article>

        <article className="relative overflow-hidden rounded-[1.3rem] border border-[#232c3a] bg-[#111317] p-5">
          <span className="absolute inset-y-0 left-0 w-1 bg-[#f0b45a]" aria-hidden="true" />
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#f0b45a]">Tu próximo pago</p>
          <p className="mt-3 text-[0.95rem] text-[#9daccc]">Pronto podrás ver cuándo y cuánto cobras.</p>
          <span className="mt-3 inline-flex w-max items-center gap-2 rounded-full border border-[#2a2f3a] bg-[#0f1217] px-3 py-1 text-[0.74rem] text-[#7f8aa3]">
            Calendario de dividendos — pendiente
          </span>
        </article>
      </div>

      {payers.length ? (
        <div>
          <p className="mb-3 px-1 text-[0.72rem] font-medium uppercase tracking-[0.1em] text-[#71819b]">Quién te paga</p>
          <div className="space-y-2">
            {payers.map((r) => (
              <PayerRow key={r.entry.assetSymbol} row={r} maxIncome={maxIncome} />
            ))}
          </div>
        </div>
      ) : null}

      {nonPayers.length ? (
        <div>
          <p className="mb-2 px-1 text-[0.72rem] font-medium uppercase tracking-[0.1em] text-[#5f6d82]">Sin dividendos</p>
          <div className="flex flex-wrap gap-2">
            {nonPayers.map((r) => (
              <span key={r.entry.assetSymbol} className="inline-flex items-center gap-2 rounded-full border border-[#1b2028] bg-[#0f1217] px-3 py-1.5 text-[0.78rem] text-[#7f8aa3]">
                <AssetAvatar assetType={r.entry.assetType} dark symbol={r.entry.assetSymbol} logoUrl={r.logoUrl} />
                {r.entry.assetSymbol}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PayerRow({ row, maxIncome }: { row: Row; maxIncome: number }) {
  const { entry, name, logoUrl, annualIncome, currency, cagr5y, shares } = row;
  const width = maxIncome > 0 ? Math.max(6, Math.round((annualIncome / maxIncome) * 100)) : 0;
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-[0.95rem] border border-[#1b2028] bg-[#0f1217] px-4 py-3 transition hover:border-[#2a313b]">
      <AssetAvatar assetType={entry.assetType} dark symbol={entry.assetSymbol} logoUrl={logoUrl} />
      <div className="min-w-0">
        <p className="truncate text-[0.92rem] font-semibold text-white">
          {name} <span className="text-[0.78rem] font-medium text-[#5f6d82]">· {entry.assetSymbol}</span>
        </p>
        <p className="mt-0.5 text-[0.8rem] text-[#7f8aa3]">
          te paga <b className="font-semibold text-[#1fd38b]">{money(annualIncome)} {currency}/año</b> · {shares} {shares === 1 ? "acción" : "acciones"}
        </p>
        <div className="mt-2 h-[5px] max-w-[260px] overflow-hidden rounded-[3px] bg-[#121a28]">
          <i className="block h-full rounded-[3px] bg-[linear-gradient(90deg,#0f9e67,#1fd38b)]" style={{ width: `${width}%` }} />
        </div>
      </div>
      <div className="text-right">
        {cagr5y != null ? (
          <span className={`text-[0.78rem] font-semibold tabular-nums ${cagr5y >= 0 ? "text-[#1fd38b]" : "text-[#ff6b6b]"}`}>
            {cagr5y >= 0 ? "+" : ""}{(cagr5y * 100).toFixed(1)}%
            <span className="ml-1 block text-[0.64rem] font-medium text-[#5f6d82]">crecim. 5A</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function DetailView({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-[1rem] border border-[#1b2028]">
      <table className="w-full min-w-[720px] border-collapse text-[0.84rem]">
        <thead>
          <tr className="border-b border-[#1b2028] text-[0.66rem] uppercase tracking-[0.08em] text-[#5f6d82]">
            <th className="px-4 py-3 text-left font-semibold">Holding</th>
            <th className="px-4 py-3 text-right font-semibold">Acciones</th>
            <th className="px-4 py-3 text-right font-semibold">Dividendo/año</th>
            <th className="px-4 py-3 text-right font-semibold">Crecim. 5A</th>
            <th className="px-4 py-3 text-right font-semibold">Próximo pago</th>
            <th className="px-4 py-3 text-right font-semibold">Ex-dividendo</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.entry.assetSymbol} className="border-b border-[#14181f] last:border-none hover:bg-[#13161b]">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <AssetAvatar assetType={r.entry.assetType} dark symbol={r.entry.assetSymbol} logoUrl={r.logoUrl} />
                  <div>
                    <p className="font-semibold text-white">{r.name}</p>
                    <p className="text-[0.7rem] text-[#5f6d82]">{r.entry.assetSymbol}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-right text-white">{r.shares}</td>
              <td className="px-4 py-3 text-right">
                {r.pays ? <span className="text-white">{money(r.annualIncome)} {r.currency}</span> : <span className="text-[#5f6d82]">—</span>}
              </td>
              <td className="px-4 py-3 text-right">
                {r.cagr5y != null ? (
                  <span className={r.cagr5y >= 0 ? "text-[#1fd38b]" : "text-[#ff6b6b]"}>{r.cagr5y >= 0 ? "+" : ""}{(r.cagr5y * 100).toFixed(1)}%</span>
                ) : (
                  <span className="text-[#5f6d82]">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-[#5f6d82]">Pendiente</td>
              <td className="px-4 py-3 text-right text-[#5f6d82]">Pendiente</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 text-[0.72rem] text-[#5f6d82]">
        Dividendo en la moneda nativa del activo. Próximo pago y ex-dividendo llegan con el calendario de dividendos del backend.
      </p>
    </div>
  );
}

function ModeTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      aria-pressed={active}
      className={active
        ? "rounded-[0.6rem] bg-[#1a2028] px-3.5 py-1.5 text-[0.8rem] font-semibold text-white shadow-[inset_0_0_0_1px_#2a313b]"
        : "rounded-[0.6rem] px-3.5 py-1.5 text-[0.8rem] font-semibold text-[#7f8aa3] transition hover:text-white"}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function money(value: number): string {
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
