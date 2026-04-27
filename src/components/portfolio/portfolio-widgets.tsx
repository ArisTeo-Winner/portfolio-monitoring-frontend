"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PortfolioHoldingsOverview } from "@/components/portfolio/portfolio-holdings-overview";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { getAssetLogoFromRegistry, readAssetLogoRegistry, type AssetLogoRegistry } from "@/features/assets/lib/asset-logo-registry";
import { startHoldingDetailTrace } from "@/features/portfolio/lib/holding-detail-performance";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";
import { formatCurrency, formatQuantity, formatSignedCurrency } from "@/lib/utils/format";

type WorkspaceTab = "assets" | "history";

export function PortfolioSummary({
  portfolioId,
  entries,
}: {
  portfolioId: string;
  entries: PortfolioEntry[];
}) {
  return (
    <section className="space-y-5">
      <PortfolioHoldingsOverview entries={entries} portfolioId={portfolioId} />
    </section>
  );
}

export function PortfolioTable({
  entries,
  onAddTransaction,
  activeTab = "assets",
  onTabChange = () => {},
  assetType,
  onHistoryChanged,
}: {
  entries: PortfolioEntry[];
  onAddTransaction: () => void;
  activeTab?: WorkspaceTab;
  onTabChange?: (tab: WorkspaceTab) => void;
  assetType?: string;
  onHistoryChanged?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [logoRegistry, setLogoRegistry] = useState<AssetLogoRegistry>({});

  useEffect(() => {
    setLogoRegistry(readAssetLogoRegistry());
  }, [entries]);

  useEffect(() => {
    const handleRefresh = () => {
      void onHistoryChanged?.();
    };

    window.addEventListener("portfolio:refresh", handleRefresh);
    return () => {
      window.removeEventListener("portfolio:refresh", handleRefresh);
    };
  }, [onHistoryChanged]);

  const visibleEntries = useMemo(() => {
    return [...entries]
      .filter((entry) => {
        const haystack = `${entry.assetSymbol} ${getAssetDisplayName(entry.assetSymbol)} ${entry.assetType}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      })
      .sort((left, right) => Number(right.currentValue) - Number(left.currentValue));
  }, [entries, search]);

  const totalInvested = useMemo(() => entries.reduce((acc, entry) => acc + Number(entry.totalInvested), 0), [entries]);
  const totalProfitLoss = useMemo(() => entries.reduce((acc, entry) => acc + Number(entry.totalProfitLoss), 0), [entries]);

  function openHoldingDetail(symbol: string) {
    startHoldingDetailTrace(symbol);
    router.push(`/portfolio/${symbol}`);
  }

  return (
    <section className="overflow-hidden rounded-[1.65rem] bg-[#111317] shadow-[0_30px_84px_rgba(0,0,0,0.32)]">
      <div className={activeTab === "history" ? "px-6 pb-0 pt-5" : "px-6 py-5"}>
          <div className={`flex items-center justify-between border-b border-zinc-800/60 bg-[#121214] px-6 ${activeTab === "history" ? "pb-0" : ""}`}>
            <div className="flex items-center gap-6">
            <TabButton active={activeTab === "assets"} label="Activos" onClick={() => onTabChange("assets")} />
            <TabButton active={activeTab === "history"} label="Transacciones" onClick={() => onTabChange("history")} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {activeTab === "assets" ? (
              <label className="group relative">
                <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f7b90] transition-colors group-focus-within:text-[#17c784]" />
                <input
                  className="w-full rounded-[0.95rem] bg-[#0f1217] py-3 pl-10 pr-4 text-[0.9rem] text-white shadow-[0_16px_34px_rgba(0,0,0,0.18)] outline-none transition placeholder:text-[#6f7b90] focus:bg-[#13161b] focus:shadow-[0_18px_38px_rgba(0,0,0,0.24),0_0_0_6px_rgba(23,199,132,0.05)] sm:w-[18rem]"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar activo o ticker..."
                  value={search}
                />
              </label>
            ) : null}

            <div className="flex items-center gap-3 rounded-[0.95rem] bg-[#0f1217] px-4 py-3 text-[0.84rem] shadow-[0_16px_34px_rgba(0,0,0,0.16)]">
              <span className="text-[#7f8aa3]">{activeTab === "assets" ? "Activos" : "Pnl"}</span>
              <span className="font-semibold text-white">
                {activeTab === "assets" ? visibleEntries.length : formatSignedCurrency(totalProfitLoss)}
              </span>
            </div>
          </div>
        </div>

        {activeTab === "assets" ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[0.82rem] text-[#7f8aa3]">
            <span className="rounded-full bg-[#0f1217] px-3 py-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.14)]">
              Invertido: <strong className="ml-1 text-white">{formatCurrency(totalInvested)}</strong>
            </span>
            <span className="rounded-full bg-[#0f1217] px-3 py-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.14)]">
              Rendimiento: <strong className={totalProfitLoss >= 0 ? "ml-1 text-[#17c784]" : "ml-1 text-[#ff6b6b]"}>{formatSignedCurrency(totalProfitLoss)}</strong>
            </span>
          </div>
        ) : null}
      </div>

      <div className={activeTab === "history" ? "px-6 pb-6 pt-0" : "px-6 py-6"}>
        {activeTab === "history" ? (
          <TransactionsTable assetType={assetType} onDeleted={onHistoryChanged} />
        ) : visibleEntries.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse">
              <thead>
                <tr className="text-left text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#71819b] [box-shadow:inset_0_-1px_0_#13161c]">
                  <th className="pb-4 pr-4">Activo</th>
                  <th className="px-4 pb-4">Saldo</th>
                  <th className="px-4 pb-4">Precio actual</th>
                  <th className="px-4 pb-4">Valor (USD)</th>
                  <th className="pb-4 pl-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((entry) => {
                  const quantity = Number(entry.totalQuantity);
                  const currentValue = Number(entry.currentValue);
                  const currentPrice = quantity > 0 ? currentValue / quantity : Number(entry.averagePricePerUnit);
                  const profitLoss = Number(entry.totalProfitLoss);
                  const totalInvestedEntry = Number(entry.totalInvested);
                  const changePercent = totalInvestedEntry > 0 ? (profitLoss / totalInvestedEntry) * 100 : 0;

                  return (
                    <tr className="group transition hover:bg-white/[0.02] [box-shadow:inset_0_-1px_0_#13161c]" key={entry.portfolioEntryId}>
                      <td className="py-5 pr-4">
                        <button className="flex w-full items-center gap-4 text-left" onClick={() => openHoldingDetail(entry.assetSymbol)} type="button">
                          <AssetAvatar logoUrl={getAssetLogoFromRegistry(logoRegistry, entry.assetSymbol, entry.assetType)} symbol={entry.assetSymbol} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-[1rem] font-semibold text-white">{getAssetDisplayName(entry.assetSymbol)}</p>
                              {entry.assetType !== "CRYPTO" ? (
                                <span className="rounded-full bg-[#15181e] px-2 py-0.5 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-[#8ea1bb] shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
                                  {entry.assetType}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[0.8rem] font-medium uppercase tracking-[0.12em] text-[#7f8aa3]">{entry.assetSymbol}</p>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-5">
                        <p className="text-[1rem] font-semibold text-white">{formatQuantity(entry.totalQuantity)}</p>
                        <p className="mt-1 text-[0.8rem] font-medium uppercase tracking-[0.12em] text-[#7f8aa3]">{entry.assetSymbol}</p>
                      </td>
                      <td className="px-4 py-5">
                        <p className="text-[1rem] font-semibold text-white">{formatCurrency(currentPrice)}</p>
                        <p className={`mt-1 text-[0.82rem] font-semibold ${changePercent >= 0 ? "text-[#17c784]" : "text-[#ff6b6b]"}`}>
                          {changePercent >= 0 ? "+" : "-"}{Math.abs(changePercent).toFixed(2)}%
                        </p>
                      </td>
                      <td className="px-4 py-5">
                        <p className="text-[1.02rem] font-semibold text-white">{formatCurrency(entry.currentValue)}</p>
                        <p className="mt-1 text-[0.82rem] font-medium text-[#7f8aa3]">Base: {formatCurrency(entry.totalInvested)}</p>
                      </td>
                      <td className="py-5 pl-4 text-right">
                        <button
                          className="inline-flex items-center gap-2 rounded-[0.95rem] bg-[#0f1217] px-3 py-2 text-[0.84rem] font-semibold text-white shadow-[0_14px_30px_rgba(0,0,0,0.16)] transition hover:bg-[#14191d] hover:text-[#49e3a5]"
                          onClick={() => openHoldingDetail(entry.assetSymbol)}
                          type="button"
                        >
                          Abrir
                          <ArrowUpRightIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-[1.35rem] bg-[#0d0f13] px-6 py-16 text-center shadow-[0_20px_42px_rgba(0,0,0,0.18)]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#12151a] shadow-[0_18px_34px_rgba(0,0,0,0.16)]">
              <EmptyPortfolioIcon className="h-9 w-9 text-[#7f8aa3]" />
            </div>
            <h2 className="mt-6 text-[1.65rem] font-semibold tracking-[-0.04em] text-white">No tienes activos registrados</h2>
            <p className="mx-auto mt-3 max-w-[36rem] text-[0.94rem] leading-7 text-[#7f8aa3]">
              Tu base de datos esta limpia. Comienza a rastrear tu portfolio registrando tu primera compra de criptomonedas, acciones o ETFs.
            </p>
            <button
              className="mt-7 rounded-[1rem] bg-[#0e7a4f] px-5 py-3 text-[0.9rem] font-semibold text-white shadow-[0_16px_34px_rgba(14,122,79,0.25)] transition hover:bg-[#11945f]"
              onClick={onAddTransaction}
              type="button"
            >
              + Registrar primera transaccion
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export function PortfolioDetailCard({ entry }: { entry: PortfolioEntry }) {
  const [logoRegistry, setLogoRegistry] = useState<AssetLogoRegistry>({});
  const pnl = Number(entry.totalProfitLoss);
  const quantity = Number(entry.totalQuantity);
  const currentValue = Number(entry.currentValue);
  const currentPrice = quantity > 0 ? currentValue / quantity : Number(entry.averagePricePerUnit);

  useEffect(() => {
    setLogoRegistry(readAssetLogoRegistry());
  }, []);

  return (
    <section className="overflow-hidden rounded-[1.65rem] bg-[#111317] p-6 shadow-[0_30px_84px_rgba(0,0,0,0.32)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-[0.72rem] font-medium uppercase tracking-[0.24em] text-[#17c784]">Holding detail</p>
          <div className="mt-4 flex items-center gap-4">
            <AssetAvatar logoUrl={getAssetLogoFromRegistry(logoRegistry, entry.assetSymbol, entry.assetType)} symbol={entry.assetSymbol} />
            <div>
              <h1 className="text-[2rem] font-semibold tracking-[-0.05em] text-white">{getAssetDisplayName(entry.assetSymbol)}</h1>
              <p className="mt-1 text-[0.88rem] uppercase tracking-[0.18em] text-[#7f8aa3]">
                {entry.assetSymbol} / {entry.assetType}
              </p>
            </div>
          </div>
        </div>

        <span className={`rounded-[1rem] px-4 py-3 text-[0.92rem] font-semibold ${pnl >= 0 ? "bg-[#0f2f24] text-[#20d48d]" : "bg-[#30191d] text-[#ff6b6b]"}`}>
          {formatSignedCurrency(entry.totalProfitLoss)}
        </span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Current value" value={formatCurrency(entry.currentValue)} />
        <MetricCard label="Total invested" value={formatCurrency(entry.totalInvested)} />
        <MetricCard label="Total quantity" value={formatQuantity(entry.totalQuantity)} />
        <MetricCard label="Current price" value={formatCurrency(currentPrice)} />
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.1rem] bg-[#0d0f13] p-4 shadow-[0_18px_36px_rgba(0,0,0,0.16)]">
      <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#71819b]">{label}</p>
      <p className="mt-3 text-[1.08rem] font-semibold text-white">{value}</p>
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`relative pb-3 text-[0.96rem] font-semibold transition ${active ? "text-white" : "text-[#7f8aa3] hover:text-white"}`}
      onClick={onClick}
      type="button"
    >
      {label}
      <span className={`absolute inset-x-0 bottom-0 h-[2px] rounded-full transition ${active ? "bg-white" : "bg-transparent"}`} />
    </button>
  );
}

function AssetAvatar({ logoUrl, symbol }: { logoUrl: string | null; symbol: string }) {
  const [failed, setFailed] = useState(false);
  const initials = symbol.slice(0, 2).toUpperCase();
  const palette = pickAssetPalette(symbol);

  if (logoUrl && !failed) {
    return (
      <Image
        alt={symbol}
        className="h-12 w-12 shrink-0 rounded-full bg-[#0f131b] object-cover"
        height={48}
        onError={() => setFailed(true)}
        src={logoUrl}
        unoptimized
        width={48}
      />
    );
  }

  return (
    <span
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[0.86rem] font-bold shadow-[0_12px_28px_rgba(0,0,0,0.24)]"
      style={{ background: `radial-gradient(circle at 30% 30%, ${palette.highlight}, ${palette.base})`, color: palette.text }}
    >
      {initials}
    </span>
  );
}

function getAssetDisplayName(symbol: string) {
  const key = symbol.toUpperCase();
  const names: Record<string, string> = {
    BTC: "Bitcoin",
    ETH: "Ethereum",
    SOL: "Solana",
    BNB: "BNB",
    XRP: "XRP",
    USDT: "Tether",
    USDC: "USD Coin",
    ADA: "Cardano",
    DOGE: "Dogecoin",
    AAPL: "Apple Inc.",
    MSFT: "Microsoft Corp.",
    GOOGL: "Alphabet Inc.",
    NVDA: "NVIDIA Corp",
    SPY: "SPDR S&P 500 ETF",
    QQQ: "Invesco QQQ Trust",
    META: "Meta Platforms",
  };

  return names[key] ?? key;
}

function pickAssetPalette(symbol: string) {
  const palettes = [
    { base: "#3861fb", highlight: "#7b97ff", text: "#f8fbff" },
    { base: "#16c784", highlight: "#6ce4b0", text: "#f7fff8" },
    { base: "#8b5cf6", highlight: "#b898ff", text: "#fff7ff" },
    { base: "#f59e0b", highlight: "#ffc45f", text: "#fff9f5" },
    { base: "#ef4444", highlight: "#ff9a9a", text: "#fff7f7" },
  ];

  const index = symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % palettes.length;
  return palettes[index];
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M16 16L21 21" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

function ArrowUpRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M7 17 17 7M17 7H9.5M17 7v7.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function EmptyPortfolioIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <rect height="12" rx="2.5" stroke="currentColor" strokeWidth="1.7" width="15" x="4.5" y="7" />
      <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15.5 13h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
    </svg>
  );
}
