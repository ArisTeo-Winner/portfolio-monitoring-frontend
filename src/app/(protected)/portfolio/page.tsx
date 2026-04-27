"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AddTransactionModal } from "@/components/transactions/add-transaction-modal";
import { CreatePortfolioModal } from "@/components/portfolio/create-portfolio-modal";
import { PortfolioSidebar, buildSidebarGroups } from "@/components/portfolio/portfolio-sidebar";
import { PortfolioSummary, PortfolioTable } from "@/components/portfolio/portfolio-widgets";
import { getAssetLogoFromRegistry, readAssetLogoRegistry, type AssetLogoRegistry } from "@/features/assets/lib/asset-logo-registry";
import { getPortfolio, invalidatePortfolioCache } from "@/features/portfolio/api/get-portfolio";
import { readPortfolioPreferences, type PortfolioPreference } from "@/features/portfolio/lib/local-portfolios";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";
import type { AssetOption } from "@/features/assets/types/asset.types";
import { ApiError } from "@/lib/api/problem-details";

function PortfolioPageContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const requestedType = (searchParams.get("type") ?? "").toUpperCase();
  const isOverviewScope = !requestedType;
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [preferences, setPreferences] = useState<PortfolioPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activePortfolioType, setActivePortfolioType] = useState<string>(requestedType);
  const [activeTab, setActiveTab] = useState<"assets" | "history">("assets");
  const [logoRegistry, setLogoRegistry] = useState<AssetLogoRegistry>({});

  const loadPortfolio = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);

    try {
      if (force) {
        invalidatePortfolioCache();
      }
      const data = await getPortfolio({ force });
      setEntries(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No fue posible cargar el portfolio.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPreferences = useCallback(() => {
    setPreferences(readPortfolioPreferences());
  }, []);

  useEffect(() => {
    void loadPortfolio();
    loadPreferences();
    setLogoRegistry(readAssetLogoRegistry());
  }, [loadPortfolio, loadPreferences]);

  useEffect(() => {
    setActivePortfolioType(isOverviewScope ? "" : requestedType);
  }, [isOverviewScope, requestedType]);

  const portfolioGroups = useMemo(() => buildSidebarGroups(entries, preferences), [entries, preferences]);
  const totalValue = useMemo(() => entries.reduce((acc, entry) => acc + Number(entry.currentValue), 0), [entries]);
  const createdCount = preferences.length > 0 ? preferences.length : portfolioGroups.length;

  useEffect(() => {
    if (!portfolioGroups.length) {
      setActivePortfolioType("");
      return;
    }
    if (isOverviewScope) {
      setActivePortfolioType("");
      return;
    }
    if (!portfolioGroups.some((group) => group.assetType === activePortfolioType)) {
      setActivePortfolioType(portfolioGroups[0].assetType);
    }
  }, [activePortfolioType, isOverviewScope, portfolioGroups]);

  const activePortfolio = activePortfolioType ? portfolioGroups.find((group) => group.assetType === activePortfolioType) : undefined;
  const filteredEntries = activePortfolio ? entries.filter((entry) => entry.assetType === activePortfolio.assetType) : entries;
  const hasExistingTransactions = entries.length > 0;
  const transactionsEnabled = true;
  const holdingsPortfolioId = isOverviewScope ? "overview" : normalizePortfolioAssetType(activePortfolio?.assetType || requestedType || "overview");

  const refreshHoldingsPerformance = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["portfolio-holdings-performance"] });
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

  return (
    <>
      <main className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <PortfolioSidebar
          activeType={activePortfolio?.assetType ?? ""}
          createdCount={createdCount}
          groups={portfolioGroups}
          onCreatePortfolio={() => setCreateModalOpen(true)}
          totalValue={totalValue}
        />

        <section className="space-y-4 pt-1">
          {loading ? <PortfolioLoadingState /> : null}
          {!loading && error ? <PortfolioErrorState message={error} onOpenModal={() => setModalOpen(true)} transactionsEnabled={transactionsEnabled} /> : null}
          {!loading && !error ? (
            <>
              <PortfolioCompactIntro />
              <PortfolioSummary entries={filteredEntries} portfolioId={holdingsPortfolioId} />
            </>
          ) : null}
          {!loading && !error ? (
            <PortfolioTable
              activeTab={activeTab}
              assetType={isOverviewScope ? undefined : activePortfolio?.assetType}
              entries={filteredEntries}
              onAddTransaction={() => setModalOpen(true)}
              onHistoryChanged={async () => {
                await loadPortfolio(true);
                await refreshHoldingsPerformance();
              }}
              onTabChange={setActiveTab}
            />
          ) : null}
        </section>
      </main>

      <AddTransactionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={async () => {
          await loadPortfolio(true);
          await refreshHoldingsPerformance();
        }}
        portfolioAssetType={isOverviewScope ? undefined : hasExistingTransactions ? activePortfolio?.assetType : undefined}
        portfolioName={isOverviewScope ? undefined : hasExistingTransactions ? activePortfolio?.label : undefined}
        requireAssetTypeSelection={isOverviewScope}
        suggestedAssets={suggestedAssets}
      />

      <CreatePortfolioModal
        existingAssetTypes={preferences.map((item) => item.assetType)}
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={loadPreferences}
      />
    </>
  );
}

function PortfolioLoadingState() {
  return (
    <section className="space-y-4 pt-1">
      <div className="space-y-2 px-1">
        <div className="h-3 w-40 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="h-11 w-72 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="h-4 w-[30rem] max-w-full animate-pulse rounded-full bg-white/[0.05]" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.9fr)]">
        <div className="h-[26rem] animate-pulse rounded-[1.65rem] bg-[#111317] shadow-[0_28px_70px_rgba(0,0,0,0.3)]" />
        <div className="h-[26rem] animate-pulse rounded-[1.65rem] bg-[#111317] shadow-[0_28px_70px_rgba(0,0,0,0.3)]" />
      </div>

      <div className="h-[26rem] animate-pulse rounded-[1.65rem] bg-[#111317] shadow-[0_28px_70px_rgba(0,0,0,0.3)]" />
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
          Registrar transaccion
        </button>
      </div>
    </section>
  );
}

function PortfolioCompactIntro() {
  return (
    <section className="space-y-2 px-1 pt-1">
      <p className="text-[0.72rem] font-medium uppercase tracking-[0.28em] text-[#17c784]">Portfolio tracker</p>
      <h1 className="text-[2rem] font-semibold tracking-[-0.05em] text-white md:text-[2.3rem]">Vista Consolidada</h1>
      <p className="max-w-[52rem] text-[0.92rem] leading-7 text-[#7f8aa3]">
        Administra activos, sigue el rendimiento de tu wallet y mantén tu historial en un solo lugar.
      </p>
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

