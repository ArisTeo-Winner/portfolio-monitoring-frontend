"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PortfolioHoldingsOverview } from "@/components/portfolio/portfolio-holdings-overview";
import { ChartToolbar } from "@/features/portfolio-chart/components/ChartToolbar";
import { PortfolioChart } from "@/features/portfolio-chart/components/PortfolioChart";
import { usePortfolioHistory } from "@/features/portfolio-chart/hooks/usePortfolioHistory";
import type { HistoryRange } from "@/features/portfolio-chart/types";
import { fetchCoinGeckoCryptoLogoMap, readCoinGeckoCryptoLogoMap } from "@/features/assets/lib/coingecko-crypto-logos";
import { getAssetLogoFromRegistry, readAssetLogoRegistry, type AssetLogoRegistry } from "@/features/assets/lib/asset-logo-registry";
import { getPortfolio, invalidatePortfolioCache } from "@/features/portfolio/api/get-portfolio";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";
import { getUserTransactions } from "@/features/transactions/api/get-transactions";
import type { TransactionResponse } from "@/features/transactions/types/transaction.types";
import { ApiError } from "@/lib/api/problem-details";
import { formatCurrency, formatQuantity, formatSignedCurrency } from "@/lib/utils/format";
import { getAssetDisplayName, normalizeAssetType } from "@/lib/utils/asset";
import { AssetAvatar } from "@/components/shared/AssetAvatar";

const DISTRIBUTION_COLORS = ["#f7931a", "#5b8ff9", "#22c55e", "#a855f7", "#14b8a6"];
type BackendHealthState = "idle" | "checking" | "up" | "slow" | "unreachable";

export default function DashboardPage() {
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [logoRegistry, setLogoRegistry] = useState<AssetLogoRegistry>(() => readAssetLogoRegistry());
  const [cryptoLogoMap, setCryptoLogoMap] = useState<Record<string, string>>(() => readCoinGeckoCryptoLogoMap());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyRange, setHistoryRange] = useState<HistoryRange>("7d");
  const { data: historyData, loading: historyLoading } = usePortfolioHistory(historyRange);

  const loadDashboard = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);

    try {
      if (force) {
        invalidatePortfolioCache();
      }

      const [portfolioData, transactionData] = await Promise.all([
        getPortfolio({ force }),
        getUserTransactions(),
      ]);

      setEntries(portfolioData);
      setTransactions(transactionData);
      setLogoRegistry(readAssetLogoRegistry());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible cargar el dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadDashboard]);

  useEffect(() => {
    const handleRefresh = () => {
      void loadDashboard(true);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("portfolio:refresh", handleRefresh);
      return () => window.removeEventListener("portfolio:refresh", handleRefresh);
    }

    return undefined;
  }, [loadDashboard]);

  useEffect(() => {
    let active = true;

    fetchCoinGeckoCryptoLogoMap()
      .then((nextMap) => {
        if (active && Object.keys(nextMap).length) {
          setCryptoLogoMap(nextMap);
        }
      })
      .catch(() => {
        // Keep dashboard functional with registry/fallback avatars.
      });

    return () => {
      active = false;
    };
  }, []);

  const totalValue = useMemo(() => entries.reduce((acc, entry) => acc + Number(entry.currentValue), 0), [entries]);
  const totalInvested = useMemo(() => entries.reduce((acc, entry) => acc + Number(entry.totalInvested), 0), [entries]);
  const totalProfit = useMemo(() => entries.reduce((acc, entry) => acc + Number(entry.totalProfitLoss), 0), [entries]);
  const changePercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  const entryCount = entries.length;

  const btcEntry = useMemo(
    () => entries.find((entry) => entry.assetSymbol.toUpperCase() === "BTC"),
    [entries],
  );
  const btcPrice = useMemo(() => {
    if (!btcEntry) return 0;
    const quantity = Number(btcEntry.totalQuantity);
    if (quantity > 0) {
      return Number(btcEntry.currentValue) / quantity;
    }
    return Number(btcEntry.lastTransactionPrice || btcEntry.averagePricePerUnit || 0);
  }, [btcEntry]);
  const btcEquivalent = btcPrice > 0 ? totalValue / btcPrice : 0;

  const sortedEntries = useMemo(
    () => [...entries].sort((left, right) => Number(right.currentValue) - Number(left.currentValue)),
    [entries],
  );
  const featuredMoves = useMemo(() => sortedEntries.slice(0, 4), [sortedEntries]);
  const bestAsset = useMemo(() => {
    return [...entries]
      .filter((entry) => Number(entry.totalInvested) > 0)
      .sort((left, right) => {
        const leftPercent = Number(left.totalInvested) > 0 ? Number(left.totalProfitLoss) / Number(left.totalInvested) : -Infinity;
        const rightPercent = Number(right.totalInvested) > 0 ? Number(right.totalProfitLoss) / Number(right.totalInvested) : -Infinity;
        return rightPercent - leftPercent;
      })[0];
  }, [entries]);

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((left, right) => new Date(right.transactionDate).getTime() - new Date(left.transactionDate).getTime())
        .slice(0, 4),
    [transactions],
  );

  const distribution = useMemo(() => buildDistribution(entries), [entries]);

  return (
    <main className="space-y-5">
      <DashboardWarmupNotice active={loading || Boolean(error)} />
      {loading ? <DashboardLoadingState /> : null}
      {!loading && error ? <DashboardErrorState message={error} /> : null}
      {!loading && !error ? (
        <>
          <section className="hidden flex-col gap-4 sm:flex lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-[2.35rem] font-semibold tracking-[-0.05em] text-white">Hola, Inversor</h1>
              <p className="mt-2 text-[0.98rem] text-[#7f8aa3]">
                Aqui esta el resumen de tu patrimonio neto al dia de hoy.
              </p>
            </div>
            <button
              className="inline-flex rounded-[1rem] bg-[#151920] px-5 py-3 text-[0.94rem] font-semibold text-white shadow-[0_16px_38px_rgba(0,0,0,0.2)] transition hover:bg-[#1a1f29]"
              onClick={() => {
                void loadDashboard(true);
              }}
              type="button"
            >
              Generar Reporte
            </button>
          </section>

          <DashboardMobileSummary
            changePercent={changePercent}
            totalProfit={totalProfit}
            totalValue={totalValue}
          />

          <section className="rounded-lg bg-[#111317] px-4 py-4 sm:rounded-[1.4rem] sm:px-6 sm:py-5 sm:shadow-[0_26px_60px_rgba(0,0,0,0.28)]">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[0.9375rem] font-semibold text-white sm:text-[1.05rem]">Historial del Portfolio</h2>
              <ChartToolbar active={historyRange} onChange={setHistoryRange} />
            </div>
            <PortfolioChart data={historyData} loading={historyLoading} />
          </section>

          <div className="hidden gap-4 sm:grid xl:grid-cols-4">
            <DashboardStatCard
              accent="neutral"
              icon={<WalletIcon className="h-12 w-12" />}
              label="Balance neto"
              subtitle={btcEquivalent > 0 ? `~ ${btcEquivalent.toFixed(3)} BTC` : "Sin referencia BTC"}
              value={formatCurrency(totalValue)}
            />
            <DashboardStatCard
              accent={totalProfit >= 0 ? "emerald" : "rose"}
              icon={<TrendDownIcon className="h-12 w-12" />}
              label="Variacion (24h)"
              subtitle={`${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`}
              value={formatSignedCurrency(totalProfit)}
            />
            <DashboardStatCard
              accent={totalProfit >= 0 ? "emerald" : "rose"}
              icon={<PulseIcon className="h-12 w-12" />}
              label="All-time PnL"
              subtitle={`${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`}
              value={formatSignedCurrency(totalProfit)}
            />
            <DashboardBestAssetCard
              asset={bestAsset}
              logoUrl={bestAsset ? resolveAssetLogo(bestAsset.assetSymbol, bestAsset.assetType, logoRegistry, cryptoLogoMap) : null}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.82fr)]">
            <PortfolioHoldingsOverview entries={entries} portfolioId="overview" />
            <DashboardDistributionCard distribution={distribution} totalAssets={entryCount} />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <DashboardFeaturedMovesCard
              entries={featuredMoves}
              logoRegistry={logoRegistry}
              cryptoLogoMap={cryptoLogoMap}
            />
            <DashboardActivityCard
              cryptoLogoMap={cryptoLogoMap}
              logoRegistry={logoRegistry}
              transactions={recentTransactions}
            />
          </div>
        </>
      ) : null}
    </main>
  );
}

function DashboardMobileSummary({
  changePercent,
  totalProfit,
  totalValue,
}: {
  changePercent: number;
  totalProfit: number;
  totalValue: number;
}) {
  const positive = totalProfit >= 0;

  return (
    <section className="rounded-lg bg-[#111317] px-4 py-4 sm:hidden">
      <p className="text-[0.68rem] font-medium uppercase tracking-[0.16em] text-[#71819b]">Balance neto</p>
      <p className="mt-2 text-[1.375rem] font-semibold leading-tight text-white">{formatCurrency(totalValue)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`text-[0.875rem] font-semibold ${positive ? "text-[#17c784]" : "text-[#ea3943]"}`}>
          {formatSignedCurrency(totalProfit)} ({changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%) 24h
        </span>
        <span className="text-[0.75rem] font-medium text-[#8a94a6]">
          {formatSignedCurrency(totalProfit)} All-Time
        </span>
      </div>
    </section>
  );
}

function DashboardWarmupNotice({ active }: { active: boolean }) {
  const [healthState, setHealthState] = useState<BackendHealthState>("idle");
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    if (!active) {
      setShowNotice(false);
      setHealthState("idle");
      return;
    }

    const controller = new AbortController();
    let mounted = true;

    setHealthState("checking");
    const timerId = window.setTimeout(() => {
      if (mounted) {
        setShowNotice(true);
      }
    }, 1200);

    void fetch("/api/health", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | { status?: string }
          | null;

        if (!mounted) {
          return;
        }

        if (response.ok && payload?.status === "UP") {
          setHealthState("up");
          setShowNotice(false);
          return;
        }

        setHealthState("slow");
        setShowNotice(true);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }

        setHealthState("unreachable");
        setShowNotice(true);
      })
      .finally(() => {
        window.clearTimeout(timerId);
      });

    return () => {
      mounted = false;
      controller.abort();
      window.clearTimeout(timerId);
    };
  }, [active]);

  if (!showNotice || healthState === "up") {
    return null;
  }

  const statusLabel =
    healthState === "unreachable" ? "Verificando backend..." : "Backend iniciando...";

  return (
    <section className="rounded-[1.1rem] border border-[#1c2a24] bg-[#0f1714] px-5 py-4 shadow-[0_18px_44px_rgba(0,0,0,0.18)]">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#5fdda5]">Version demo</p>
          <p className="mt-1 text-[0.9rem] leading-6 text-[#b7c7c0]">
            El backend puede tardar unos segundos en responder tras periodos de inactividad.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-[#11211b] px-3 py-1 text-[0.76rem] font-medium text-[#8ec8ae]">
          {statusLabel}
        </span>
      </div>
    </section>
  );
}

function DashboardLoadingState() {
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-10 w-64 animate-pulse rounded-full bg-[#111317]" />
          <div className="h-5 w-96 animate-pulse rounded-full bg-[#111317]" />
        </div>
        <div className="h-12 w-44 animate-pulse rounded-[1rem] bg-[#111317]" />
      </div>
      <div className="grid gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="h-36 animate-pulse rounded-[1.4rem] bg-[#111317] shadow-[0_26px_60px_rgba(0,0,0,0.28)]" key={index} />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.82fr)]">
        <div className="h-[28rem] animate-pulse rounded-[1.4rem] bg-[#111317] shadow-[0_26px_60px_rgba(0,0,0,0.28)]" />
        <div className="h-[28rem] animate-pulse rounded-[1.4rem] bg-[#111317] shadow-[0_26px_60px_rgba(0,0,0,0.28)]" />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-[24rem] animate-pulse rounded-[1.4rem] bg-[#111317] shadow-[0_26px_60px_rgba(0,0,0,0.28)]" />
        <div className="h-[24rem] animate-pulse rounded-[1.4rem] bg-[#111317] shadow-[0_26px_60px_rgba(0,0,0,0.28)]" />
      </div>
    </div>
  );
}

function DashboardErrorState({ message }: { message: string }) {
  return (
    <section className="rounded-[1.4rem] bg-[#111317] px-6 py-10 shadow-[0_30px_84px_rgba(0,0,0,0.32)]">
      <p className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#ff6b6b]">Dashboard unavailable</p>
      <h2 className="mt-3 text-[1.45rem] font-semibold tracking-[-0.04em] text-white">No fue posible cargar la vista global</h2>
      <p className="mt-2 max-w-[44rem] text-[0.92rem] leading-7 text-[#7f8aa3]">{message}</p>
    </section>
  );
}

function DashboardStatCard({
  label,
  value,
  subtitle,
  icon,
  accent,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: "neutral" | "emerald" | "rose";
}) {
  const valueClass = accent === "emerald" ? "text-[#17c784]" : accent === "rose" ? "text-[#ea3943]" : "text-white";
  const badgeClass =
    accent === "emerald"
      ? "bg-[#0f2f24] text-[#17c784]"
      : accent === "rose"
        ? "bg-[#30191d] text-[#ea3943]"
        : "bg-[#13161c] text-[#8a94a6]";
  const iconClass =
    accent === "emerald" ? "text-[#17c784]/22" : accent === "rose" ? "text-[#ea3943]/22" : "text-white/[0.08]";

  return (
    <section className="relative overflow-hidden rounded-[1.4rem] bg-[#111317] px-6 py-6 shadow-[0_26px_60px_rgba(0,0,0,0.28)]">
      <div className={`pointer-events-none absolute right-5 top-5 ${iconClass}`}>{icon}</div>
      <p className="text-[0.8rem] font-medium uppercase tracking-[0.18em] text-[#71819b]">{label}</p>
      <p className={`mt-4 text-[2rem] font-semibold tracking-[-0.05em] ${valueClass}`}>{value}</p>
      <span className={`mt-4 inline-flex rounded-[0.7rem] px-2.5 py-1 text-[0.8rem] font-semibold ${badgeClass}`}>{subtitle}</span>
    </section>
  );
}

function DashboardBestAssetCard({
  asset,
  logoUrl,
}: {
  asset?: PortfolioEntry;
  logoUrl: string | null;
}) {
  if (!asset) {
    return (
      <section className="rounded-[1.4rem] bg-[#111317] px-6 py-6 shadow-[0_26px_60px_rgba(0,0,0,0.28)]">
        <p className="text-[0.8rem] font-medium uppercase tracking-[0.18em] text-[#71819b]">Mejor activo</p>
        <p className="mt-4 text-[1.8rem] font-semibold tracking-[-0.05em] text-white">--</p>
        <span className="mt-4 inline-flex rounded-[0.7rem] bg-[#13161c] px-2.5 py-1 text-[0.8rem] font-semibold text-[#8a94a6]">
          Sin datos
        </span>
      </section>
    );
  }

  const invested = Number(asset.totalInvested);
  const percent = invested > 0 ? (Number(asset.totalProfitLoss) / invested) * 100 : 0;

  return (
    <section className="relative overflow-hidden rounded-[1.4rem] bg-[#111317] px-6 py-6 shadow-[0_26px_60px_rgba(0,0,0,0.28)]">
      <div className="pointer-events-none absolute right-5 top-5 text-[#f59e0b]/18">
        <FlameIcon className="h-12 w-12" />
      </div>
      <p className="text-[0.8rem] font-medium uppercase tracking-[0.18em] text-[#71819b]">Mejor activo</p>
      <div className="mt-4 flex items-center gap-3">
        <AssetAvatar logoUrl={logoUrl} symbol={asset.assetSymbol} />
        <div>
          <p className="text-[1.7rem] font-semibold tracking-[-0.05em] text-white">{getAssetDisplayName(asset.assetSymbol)}</p>
          <span className="mt-2 inline-flex rounded-[0.7rem] bg-[#0f2f24] px-2.5 py-1 text-[0.8rem] font-semibold text-[#17c784]">
            {percent >= 0 ? "+" : ""}{percent.toFixed(2)}%
          </span>
        </div>
      </div>
    </section>
  );
}

function DashboardDistributionCard({
  distribution,
  totalAssets,
}: {
  distribution: Array<{ symbol: string; label: string; share: number; color: string }>;
  totalAssets: number;
}) {
  return (
    <section className="rounded-lg bg-[#111317] p-4 shadow-none sm:rounded-[1.4rem] sm:px-6 sm:py-6 sm:shadow-[0_26px_60px_rgba(0,0,0,0.28)]">
      <div className="flex items-center justify-between">
        <h2 className="text-[0.9375rem] font-semibold text-white sm:text-[1.05rem]">Distribucion</h2>
        <ClockIcon className="h-5 w-5 text-[#8a94a6]" />
      </div>

      {distribution.length ? (
        <>
          <div className="mt-3 flex justify-center sm:mt-6">
            <DistributionDonut assetCount={totalAssets} segments={distribution} />
          </div>
          <div className="mt-3 space-y-2 sm:mt-6 sm:space-y-3">
            {distribution.map((item) => (
              <div className="flex items-center justify-between gap-2 text-[0.75rem] sm:gap-3 sm:text-[0.95rem]" key={item.symbol}>
                <div className="flex items-center gap-2 text-[#d7dfeb] sm:gap-3">
                  <span className="h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3" style={{ backgroundColor: item.color }} />
                  <span>{item.label}</span>
                </div>
                <span className="font-semibold text-[#9fb0c8]">{item.share.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex min-h-[18rem] items-center justify-center text-center text-[0.9rem] text-[#7f8aa3]">
          No hay activos suficientes para construir la distribucion.
        </div>
      )}
    </section>
  );
}

function DashboardFeaturedMovesCard({
  entries,
  logoRegistry,
  cryptoLogoMap,
}: {
  entries: PortfolioEntry[];
  logoRegistry: AssetLogoRegistry;
  cryptoLogoMap: Record<string, string>;
}) {
  return (
    <section className="overflow-hidden rounded-lg bg-[#111317] shadow-none sm:rounded-[1.4rem] sm:shadow-[0_26px_60px_rgba(0,0,0,0.28)]">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 sm:border-[#171b22] sm:px-6 sm:py-5">
        <h2 className="text-[0.9375rem] font-semibold text-white sm:text-[1.05rem]">Movimientos Destacados (24h)</h2>
        <TrendMiniIcon className="h-5 w-5 text-[#8a94a6]" />
      </div>

      {entries.length ? (
        <div className="divide-y divide-[#171b22]">
          {entries.map((entry) => {
            const quantity = Number(entry.totalQuantity);
            const currentValue = Number(entry.currentValue);
            const currentPrice = quantity > 0 ? currentValue / quantity : Number(entry.averagePricePerUnit);
            const totalInvested = Number(entry.totalInvested);
            const percent = totalInvested > 0 ? (Number(entry.totalProfitLoss) / totalInvested) * 100 : 0;

            return (
              <article className="flex min-h-[56px] items-center justify-between gap-2 border-b border-white/5 px-4 py-2 last:border-b-0 sm:gap-4 sm:border-b-0 sm:px-6 sm:py-4" key={entry.portfolioEntryId}>
                <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                  <AssetAvatar
                    logoUrl={resolveAssetLogo(entry.assetSymbol, entry.assetType, logoRegistry, cryptoLogoMap)}
                    symbol={entry.assetSymbol}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[0.875rem] font-semibold text-white sm:text-[1rem]">{getAssetDisplayName(entry.assetSymbol)}</p>
                    <p className="mt-0.5 text-[0.6875rem] text-[#7f8aa3] sm:mt-1 sm:text-[0.82rem]">
                      {formatQuantity(entry.totalQuantity)} {entry.assetSymbol.toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[0.8125rem] font-semibold text-white sm:text-[1rem]">{formatCurrency(currentPrice)}</p>
                  <p className={`mt-0.5 text-[0.6875rem] font-semibold sm:mt-1 sm:text-[0.82rem] ${percent >= 0 ? "text-[#17c784]" : "text-[#ea3943]"}`}>
                    {percent >= 0 ? "+" : "-"} {Math.abs(percent).toFixed(2)}%
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <DashboardEmptyState description="Aun no hay activos en cartera para destacar." title="Sin movimientos destacados" />
      )}
    </section>
  );
}

function DashboardActivityCard({
  transactions,
  logoRegistry,
  cryptoLogoMap,
}: {
  transactions: TransactionResponse[];
  logoRegistry: AssetLogoRegistry;
  cryptoLogoMap: Record<string, string>;
}) {
  return (
    <section className="overflow-hidden rounded-lg bg-[#111317] shadow-none sm:rounded-[1.4rem] sm:shadow-[0_26px_60px_rgba(0,0,0,0.28)]">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 sm:border-[#171b22] sm:px-6 sm:py-5">
        <h2 className="text-[0.9375rem] font-semibold text-white sm:text-[1.05rem]">Actividad Reciente</h2>
        <Link className="text-[0.75rem] font-semibold text-[#17c784] transition hover:text-[#33e09b] sm:text-[0.92rem]" href="/transactions">
          Ver todas {"->"}
        </Link>
      </div>

      {transactions.length ? (
        <div className="divide-y divide-[#171b22]">
          {transactions.map((transaction) => {
            const isSell = transaction.transactionType.toUpperCase() === "SELL";
            const logoUrl = resolveAssetLogo(transaction.assetSymbol, transaction.assetType, logoRegistry, cryptoLogoMap);

            return (
              <article className="flex min-h-[56px] items-center justify-between gap-2 border-b border-white/5 px-4 py-2 last:border-b-0 sm:gap-4 sm:border-b-0 sm:px-6 sm:py-4" key={transaction.transactionId}>
                <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-9 sm:w-9 ${isSell ? "bg-[#30191d] text-[#ea3943]" : "bg-[#0f2f24] text-[#17c784]"}`}
                  >
                    {isSell ? <ArrowDownIcon className="h-4 w-4" /> : <ArrowUpIcon className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[0.875rem] font-semibold text-white sm:text-[1rem]">
                      {isSell ? "Venta" : "Compra"} de {getAssetDisplayName(transaction.assetSymbol)}
                    </p>
                    <p className="mt-0.5 text-[0.6875rem] text-[#7f8aa3] sm:mt-1 sm:text-[0.82rem]">{formatActivityMeta(transaction)}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <AssetAvatar logoUrl={logoUrl} symbol={transaction.assetSymbol} size="sm" />
                    <p className={`text-[0.8125rem] font-semibold sm:text-[1rem] ${isSell ? "text-[#ea3943]" : "text-[#17c784]"}`}>
                      {isSell ? "-" : "+"}{formatQuantity(transaction.quantity)} {transaction.assetSymbol.toUpperCase()}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[0.6875rem] text-[#8a94a6] sm:mt-1 sm:text-[0.82rem]">{formatCurrency(transaction.totalValue)}</p>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <DashboardEmptyState description="Las operaciones nuevas apareceran aqui automaticamente." title="Sin actividad reciente" />
      )}
    </section>
  );
}

function DashboardEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <h3 className="text-[1rem] font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-[22rem] text-[0.84rem] leading-6 text-[#7f8aa3]">{description}</p>
    </div>
  );
}


function DistributionDonut({
  assetCount,
  segments,
}: {
  assetCount: number;
  segments: Array<{ symbol: string; label: string; share: number; color: string }>;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const renderedSegments = segments.reduce<
    Array<{ color: string; length: number; offset: number; symbol: string }>
  >((acc, segment) => {
    const previous = acc[acc.length - 1];
    const offset = previous ? previous.offset + previous.length : 0;
    const length = (segment.share / 100) * circumference;

    acc.push({
      color: segment.color,
      length,
      offset,
      symbol: segment.symbol,
    });

    return acc;
  }, []);

  return (
    <div className="relative flex h-[10rem] w-full items-center justify-center sm:h-[14rem]">
      <svg className="h-[10rem] w-[10rem] -rotate-90 sm:h-[13rem] sm:w-[13rem]" viewBox="0 0 140 140">
        <circle cx="70" cy="70" fill="none" r={radius} stroke="#16191e" strokeWidth="16" />
        {renderedSegments.map((segment) => {
          const strokeDasharray = `${segment.length} ${circumference - segment.length}`;

          return (
            <circle
              cx="70"
              cy="70"
              fill="none"
              key={segment.symbol}
              r={radius}
              stroke={segment.color}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={-segment.offset}
              strokeLinecap="round"
              strokeWidth="16"
            />
          );
        })}
      </svg>

      <div className="absolute text-center">
        <p className="text-[1.375rem] font-semibold text-white sm:text-[2rem] sm:tracking-[-0.05em]">{assetCount}</p>
        <p className="mt-0.5 text-[0.75rem] text-[#7f8aa3] sm:mt-1 sm:text-[0.86rem]">Activos</p>
      </div>
    </div>
  );
}

function buildDistribution(entries: PortfolioEntry[]) {
  const total = entries.reduce((acc, entry) => acc + Number(entry.currentValue), 0);

  return [...entries]
    .filter((entry) => Number(entry.currentValue) > 0)
    .sort((left, right) => Number(right.currentValue) - Number(left.currentValue))
    .slice(0, 5)
    .map((entry, index) => ({
      symbol: entry.assetSymbol,
      label: getAssetDisplayName(entry.assetSymbol),
      share: total > 0 ? (Number(entry.currentValue) / total) * 100 : 0,
      color: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length],
    }));
}

function resolveAssetLogo(
  symbol: string,
  assetType: string,
  registry: AssetLogoRegistry,
  cryptoLogoMap: Record<string, string>,
) {
  const storedLogo = getAssetLogoFromRegistry(registry, symbol, assetType);
  if (storedLogo) return storedLogo;

  return normalizeAssetType(assetType) === "CRYPTO"
    ? cryptoLogoMap[symbol.toUpperCase()] ?? null
    : null;
}


function formatActivityMeta(transaction: TransactionResponse) {
  const exchange = transaction.notes?.trim() ? transaction.notes : "Sin nota";
  const date = new Date(transaction.transactionDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${date} - ${exchange}`;
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <rect height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8" width="14" x="5" y="7" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h4A1.5 1.5 0 0 1 16 5.5V7" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function TrendDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M4 7h5.5l3.25 3.25L20 3m0 0v6.5M20 3h-6.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function PulseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M3 12h4l2.1-4.5L12.6 16l2.4-5H21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12.5 3.5c1.1 3.2-1.5 4.8-.7 7 .5 1.5 2.3 2.2 2.3 4.4A4.6 4.6 0 1 1 5 14.8c0-3 2-4.7 4.3-6.7 1.3-1.1 2.2-2.2 3.2-4.6Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5v5l3.5 2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function TrendMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="m5 15 4-4 3 3 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M15 8h3v3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 17V7m0 0-4 4m4-4 4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ArrowDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 7v10m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}
