"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { CreatePortfolioModal } from "@/components/portfolio/create-portfolio-modal";
import { useAddTransactionModal } from "@/components/layout/add-transaction-modal-context";
import { PortfolioSidebar } from "@/components/portfolio/portfolio-sidebar";
import { buildSidebarGroups } from "@/components/portfolio/portfolio-sidebar-data";
import { PortfolioSummary, PortfolioTable } from "@/components/portfolio/portfolio-widgets";
import { getAssetLogoFromRegistry, readAssetLogoRegistry, type AssetLogoRegistry } from "@/features/assets/lib/asset-logo-registry";
import { getPortfolio, invalidatePortfolioCache } from "@/features/portfolio/api/get-portfolio";
import { getUsdMxnRateCached } from "@/features/marketdata/api/get-usd-mxn-rate";
import { readPortfolioPreferences, type PortfolioPreference } from "@/features/portfolio/lib/local-portfolios";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";
import { usePortfolioStore } from "@/state/portfolio.store";
import type { SidebarGroup } from "@/components/portfolio/portfolio-sidebar-data";
import type { AssetOption } from "@/features/assets/types/asset.types";
import { ApiError } from "@/lib/api/problem-details";
import { computePortfolioTotals, formatPortfolioTotal } from "@/lib/utils/currency";

function PortfolioPageContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const syncStore = usePortfolioStore((s) => s.syncFromEntries);
  const removePortfolio = usePortfolioStore((s) => s.removePortfolio);
  const setDefaultPortfolio = usePortfolioStore((s) => s.setDefaultPortfolio);
  const defaultPortfolio = usePortfolioStore((s) => s.defaultPortfolio);
  const requestedType = (searchParams.get("type") ?? "").toUpperCase();
  const isOverviewScope = !requestedType;
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [preferences, setPreferences] = useState<PortfolioPreference[]>([]);
  const [usdMxnRate, setUsdMxnRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { openAddTransactionModal } = useAddTransactionModal();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<SidebarGroup | null>(null);
  const [activeTab, setActiveTab] = useState<"assets" | "history">("assets");
  const [logoRegistry, setLogoRegistry] = useState<AssetLogoRegistry>({});

  const loadPortfolio = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);

    try {
      if (force) {
        invalidatePortfolioCache();
      }
      const [data, fxRate] = await Promise.all([
        getPortfolio({ force }),
        getUsdMxnRateCached()
          .then((fx) => fx.rate)
          .catch(() => null),
      ]);
      setEntries(data);
      setUsdMxnRate(fxRate);
      void syncStore(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible cargar el portfolio.");
    } finally {
      setLoading(false);
    }
  }, [syncStore]);

  const loadPreferences = useCallback(() => {
    setPreferences(readPortfolioPreferences());
  }, []);

  useEffect(() => {
    void loadPortfolio();
    loadPreferences();
    setLogoRegistry(readAssetLogoRegistry());
  }, [loadPortfolio, loadPreferences]);

  const portfolioGroups = useMemo(() => buildSidebarGroups(entries, preferences), [entries, preferences]);
  const totalValueLabel = useMemo(
    () => formatPortfolioTotal(computePortfolioTotals(entries, usdMxnRate)),
    [entries, usdMxnRate],
  );
  const _createdCount = preferences.length > 0 ? preferences.length : portfolioGroups.length;

  // Derive active portfolio directly from URL — no intermediate state that can desync
  const activePortfolio = isOverviewScope
    ? undefined
    : portfolioGroups.find((group) => group.assetType === requestedType);

  const filteredEntries = activePortfolio
    ? entries.filter((entry) => entry.assetType === activePortfolio.assetType)
    : entries;
  const hasExistingTransactions = entries.length > 0;
  const transactionsEnabled = true;
  const holdingsPortfolioId = isOverviewScope ? "overview" : normalizePortfolioAssetType(activePortfolio?.assetType || requestedType || "overview");

  const refreshHoldingsPerformance = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["portfolio-holdings-performance"] });
    await queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
  }, [queryClient]);

  const suggestedAssets = useMemo<AssetOption[]>(() => {
    return filteredEntries.map((entry) => ({
      assetId: entry.portfolioEntryId,
      symbol: entry.assetSymbol,
      name: entry.assetSymbol,
      assetType: entry.assetType,
      logoUrl: getAssetLogoFromRegistry(logoRegistry, entry.assetSymbol, entry.assetType),
      supportedForTransactions: true,
      suggestedPrice: Number(entry.lastTransactionPrice || entry.averagePricePerUnit || 0),
    }));
  }, [filteredEntries, logoRegistry]);

  const handleOpenAddTransaction = useCallback(() => {
    openAddTransactionModal({
      portfolioAssetType: isOverviewScope ? undefined : hasExistingTransactions ? activePortfolio?.assetType : undefined,
      portfolioName: isOverviewScope ? undefined : hasExistingTransactions ? activePortfolio?.label : undefined,
      requireAssetTypeSelection: isOverviewScope,
      suggestedAssets,
    });
  }, [activePortfolio?.assetType, activePortfolio?.label, hasExistingTransactions, isOverviewScope, openAddTransactionModal, suggestedAssets]);

  useEffect(() => {
    function handleRefresh() {
      void loadPortfolio(true);
      void refreshHoldingsPerformance();
    }
    window.addEventListener("portfolio:refresh", handleRefresh);
    return () => window.removeEventListener("portfolio:refresh", handleRefresh);
  }, [loadPortfolio, refreshHoldingsPerformance]);

  return (
    <>
      <main className="grid gap-5 max-sm:gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden md:block">
          <PortfolioSidebar
            activeType={activePortfolio?.assetType ?? ""}
            defaultType={defaultPortfolio}
            groups={portfolioGroups}
            onCreatePortfolio={() => setCreateModalOpen(true)}
            onEditPortfolio={(group) => { setEditingPortfolio(group); setCreateModalOpen(true); }}
            onRemovePortfolio={(assetType) => { removePortfolio(assetType); loadPreferences(); }}
            onSetDefault={(assetType) => setDefaultPortfolio(assetType)}
            totalValueLabel={totalValueLabel}
          />
        </div>

        <section className="space-y-4 pt-1 max-sm:space-y-0 max-sm:pt-0">
          {loading ? <PortfolioLoadingState /> : null}
          {!loading && error ? <PortfolioErrorState message={error} onOpenModal={handleOpenAddTransaction} transactionsEnabled={transactionsEnabled} /> : null}
          {!loading && !error ? (
            <>
              <PortfolioCompactIntro onAddTransaction={handleOpenAddTransaction} />
              <PortfolioSummary entries={filteredEntries} portfolioId={holdingsPortfolioId} />
              <MobilePortfolioActions
                onAddTransaction={handleOpenAddTransaction}
              />
            </>
          ) : null}
          {!loading && !error ? (
            <PortfolioTable
              activeTab={activeTab}
              assetType={isOverviewScope ? undefined : activePortfolio?.assetType}
              entries={filteredEntries}
              onAddTransaction={handleOpenAddTransaction}
              onHistoryChanged={async () => {
                await loadPortfolio(true);
                await refreshHoldingsPerformance();
              }}
              onTabChange={setActiveTab}
            />
          ) : null}
        </section>
      </main>

      <CreatePortfolioModal
        editingPortfolio={editingPortfolio ?? undefined}
        existingAssetTypes={preferences.map((item) => item.assetType)}
        isOpen={createModalOpen}
        onClose={() => { setCreateModalOpen(false); setEditingPortfolio(null); }}
        onCreated={() => { loadPreferences(); setEditingPortfolio(null); }}
      />
    </>
  );
}

function PortfolioLoadingState() {
  return (
    <section className="space-y-4 pt-1 max-sm:space-y-3 max-sm:pt-0">
      <div className="space-y-2 px-1 max-sm:px-3 max-sm:py-3">
        <div className="h-3 w-40 animate-pulse rounded-full bg-white/[0.06] max-sm:w-24" />
        <div className="h-11 w-72 animate-pulse rounded-full bg-white/[0.06] max-sm:h-7 max-sm:w-44" />
        <div className="h-4 w-[30rem] max-w-full animate-pulse rounded-full bg-white/[0.05] max-sm:h-3 max-sm:w-32" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.9fr)]">
        <div className="h-[26rem] animate-pulse rounded-[1.65rem] bg-[#111317] shadow-[0_28px_70px_rgba(0,0,0,0.3)] max-sm:h-[11.25rem] max-sm:rounded-none max-sm:bg-[#151922] max-sm:shadow-none" />
        <div className="h-[26rem] animate-pulse rounded-[1.65rem] bg-[#111317] shadow-[0_28px_70px_rgba(0,0,0,0.3)] max-sm:hidden" />
      </div>

      <div className="h-[26rem] animate-pulse rounded-[1.65rem] bg-[#111317] shadow-[0_28px_70px_rgba(0,0,0,0.3)] max-sm:h-40 max-sm:rounded-none max-sm:bg-[#151922] max-sm:shadow-none" />
    </section>
  );
}

function PortfolioErrorState({ message, onOpenModal, transactionsEnabled }: { message: string; onOpenModal: () => void; transactionsEnabled: boolean }) {
  return (
    <section className="rounded-[1.65rem] bg-[#111317] p-6 text-[#eaecef] shadow-[0_30px_84px_rgba(0,0,0,0.32)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#ff6b6b]">Portfolio unavailable</p>
          <h2 className="mt-3 text-[1.5rem] font-semibold tracking-[-0.04em] text-white">No fue posible cargar el dashboard</h2>
          <p className="mt-2 max-w-[44rem] text-[0.92rem] leading-7 text-[#8a94a6]">{message}</p>
        </div>
        <button
          className="rounded-[1rem] bg-[#0e7a4f] px-4 py-3 text-[0.9rem] font-semibold text-white shadow-[0_16px_34px_rgba(14,122,79,0.25)] transition hover:bg-[#11945f] disabled:cursor-not-allowed disabled:opacity-55"
          disabled={!transactionsEnabled}
          onClick={onOpenModal}
          type="button"
        >
          Registrar transacción
        </button>
      </div>
    </section>
  );
}

function PortfolioCompactIntro({ onAddTransaction }: { onAddTransaction: () => void }) {
  return (
    <section className="hidden items-start justify-between gap-4 px-1 pt-1 md:flex">
      <div className="space-y-2">
        <p className="text-[0.72rem] font-medium uppercase tracking-[0.28em] text-[#17c784]">Portfolio tracker</p>
        <h1 className="text-[2rem] font-semibold tracking-[-0.05em] text-white md:text-[2.3rem]">Vista Consolidada</h1>
        <p className="max-w-[52rem] text-[0.92rem] leading-7 text-[#7f8aa3]">
          Administra activos, sigue el rendimiento de tu wallet y mantén tu historial en un solo lugar.
        </p>
      </div>
      <button
        className="mt-1 inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#0e7a4f] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(14,122,79,0.25)] transition hover:bg-[#11945f] active:brightness-90"
        onClick={onAddTransaction}
        type="button"
      >
        <Plus className="h-4 w-4" />
        Add Transaction
      </button>
    </section>
  );
}

function MobilePortfolioActions({
  onAddTransaction,
}: {
  onAddTransaction: () => void;
}) {
  return (
    <section className="grid grid-cols-2 gap-2 border-b border-[#262D3D] bg-[#0F1116] px-3 py-3 md:hidden">
      <button
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-[0.8rem] bg-[#0e7a4f] px-3 text-[0.875rem] font-medium text-white active:brightness-110"
        onClick={onAddTransaction}
        type="button"
      >
        <Plus className="h-4 w-4" />
        Comprar
      </button>
      <button
        className="inline-flex h-9 items-center justify-center rounded-[0.8rem] bg-[#262D3D] px-3 text-[0.875rem] font-medium text-white active:brightness-110"
        onClick={onAddTransaction}
        type="button"
      >
        Vender
      </button>
    </section>
  );
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={<PortfolioLoadingState />}>
      <PortfolioPageContent />
    </Suspense>
  );
}

function normalizePortfolioAssetType(assetType: string) {
  const normalized = assetType.toUpperCase();
  if (normalized === "STOCKS") return "STOCK";
  return normalized;
}
