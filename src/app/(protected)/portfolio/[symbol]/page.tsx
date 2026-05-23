"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CreatePortfolioModal } from "@/components/portfolio/create-portfolio-modal";
import { PortfolioDetailCard } from "@/components/portfolio/portfolio-widgets";
import { PortfolioSidebar } from "@/components/portfolio/portfolio-sidebar";
import { buildSidebarGroups } from "@/components/portfolio/portfolio-sidebar-data";
import { AddTransactionModal } from "@/components/transactions/add-transaction-modal";
import { getAssetLogoFromRegistry, readAssetLogoRegistry, type AssetLogoRegistry } from "@/features/assets/lib/asset-logo-registry";
import type { AssetOption } from "@/features/assets/types/asset.types";
import { AssetChartContainer } from "@/components/portfolio/asset-chart-container";
import { getPortfolio } from "@/features/portfolio/api/get-portfolio";
import { getPortfolioEntry } from "@/features/portfolio/api/get-portfolio-entry";
import {
  clearHoldingDetailPerformance,
  clearHoldingDetailTrace,
  markHoldingDetailPerformance,
  measureHoldingDetailPerformance,
  readHoldingDetailTrace,
} from "@/features/portfolio/lib/holding-detail-performance";
import { readPortfolioPreferences, type PortfolioPreference } from "@/features/portfolio/lib/local-portfolios";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";
import { getUserTransactions } from "@/features/transactions/api/get-transactions";
import type { TransactionResponse } from "@/features/transactions/types/transaction.types";
import { ApiError } from "@/lib/api/problem-details";
import { formatCurrency, formatFeeCurrency, formatQuantity } from "@/lib/utils/format";
import { getAssetDisplayName } from "@/lib/utils/asset";

const SUPPORTED_TRANSACTION_TYPES = new Set(["CRYPTO", "STOCK", "ETF"]);
const HOLDING_DETAIL_MEASURE_TYPES = {
  pageMounted: "page-mounted",
  entryRequestStart: "entry-request-start",
  entryRequestEnd: "entry-request-end",
  transactionsRequestStart: "transactions-request-start",
  transactionsRequestEnd: "transactions-request-end",
} as const;

export default function PortfolioSymbolPage() {
  const params = useParams<{ symbol: string }>();
  const router = useRouter();
  const symbol = String(params.symbol ?? "").toUpperCase();
  const [entry, setEntry] = useState<PortfolioEntry | null>(null);
  const [portfolioEntries, setPortfolioEntries] = useState<PortfolioEntry[]>([]);
  const [preferences, setPreferences] = useState<PortfolioPreference[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [logoRegistry, setLogoRegistry] = useState<AssetLogoRegistry>({});
  const traceRef = useRef<{
    symbol: string;
    navigationStartedAt: number | null;
    mountedAt: number;
    entryFetchMs: number | null;
    transactionsFetchMs: number | null;
    sidebarFetchMs: number | null;
    reportedEntryReady: boolean;
    reportedTransactionsReady: boolean;
    markNames: string[];
    measureNames: string[];
  } | null>(null);

  const loadPreferences = useCallback(() => {
    setPreferences(readPortfolioPreferences());
  }, []);

  const loadSidebarPortfolio = useCallback(async () => {
    const sidebarFetchStartedAt = typeof window !== "undefined" ? window.performance.now() : 0;

    try {
      const data = await getPortfolio();
      setPortfolioEntries(data);
    } catch {
      setPortfolioEntries([]);
    } finally {
      if (typeof window !== "undefined" && traceRef.current?.symbol === symbol) {
        traceRef.current.sidebarFetchMs = window.performance.now() - sidebarFetchStartedAt;
      }
    }
  }, [symbol]);

  const loadEntry = useCallback(async () => {
    if (!symbol) {
      setError("Invalid asset symbol.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const requestStartMark = getHoldingDetailMarkName(symbol, HOLDING_DETAIL_MEASURE_TYPES.entryRequestStart);
      const requestEndMark = getHoldingDetailMarkName(symbol, HOLDING_DETAIL_MEASURE_TYPES.entryRequestEnd);

      markHoldingDetailPerformance(requestStartMark);
      const data = await getPortfolioEntry(symbol);
      markHoldingDetailPerformance(requestEndMark);
      setEntry(data);

      if (traceRef.current?.symbol === symbol) {
        traceRef.current.entryFetchMs = measureHoldingDetailPerformance(
          getHoldingDetailMeasureName(symbol, "entry-fetch"),
          requestStartMark,
          requestEndMark,
        );
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError(`The portfolio has no holding for ${symbol}.`);
      } else {
        setError(err instanceof ApiError ? err.message : "No fue posible cargar el holding.");
      }
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  const loadTransactions = useCallback(async () => {
    if (!symbol) {
      setTransactionsLoading(false);
      return;
    }

    setTransactionsLoading(true);
    setTransactionsError(null);

    try {
      const requestStartMark = getHoldingDetailMarkName(symbol, HOLDING_DETAIL_MEASURE_TYPES.transactionsRequestStart);
      const requestEndMark = getHoldingDetailMarkName(symbol, HOLDING_DETAIL_MEASURE_TYPES.transactionsRequestEnd);

      markHoldingDetailPerformance(requestStartMark);
      const data = await getUserTransactions({ assetSymbol: symbol });
      markHoldingDetailPerformance(requestEndMark);
      const ordered = [...data].sort(
        (left, right) =>
          new Date(right.transactionDate).getTime() - new Date(left.transactionDate).getTime(),
      );
      setTransactions(ordered);

      if (traceRef.current?.symbol === symbol) {
        traceRef.current.transactionsFetchMs = measureHoldingDetailPerformance(
          getHoldingDetailMeasureName(symbol, "transactions-fetch"),
          requestStartMark,
          requestEndMark,
        );
      }
    } catch (err) {
      setTransactionsError(
        err instanceof ApiError ? err.message : "No fue posible cargar las transacciones.",
      );
    } finally {
      setTransactionsLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    const navigationTrace = readHoldingDetailTrace(symbol);
    const markNames = Object.values(HOLDING_DETAIL_MEASURE_TYPES).map((measureType) =>
      getHoldingDetailMarkName(symbol, measureType),
    );
    const measureNames = [
      getHoldingDetailMeasureName(symbol, "entry-fetch"),
      getHoldingDetailMeasureName(symbol, "transactions-fetch"),
    ];

    traceRef.current = {
      symbol,
      navigationStartedAt: navigationTrace?.startedAt ?? null,
      mountedAt: typeof window !== "undefined" ? window.performance.now() : 0,
      entryFetchMs: null,
      transactionsFetchMs: null,
      sidebarFetchMs: null,
      reportedEntryReady: false,
      reportedTransactionsReady: false,
      markNames,
      measureNames,
    };

    markHoldingDetailPerformance(getHoldingDetailMarkName(symbol, HOLDING_DETAIL_MEASURE_TYPES.pageMounted));
    loadPreferences();
    void loadSidebarPortfolio();
    void loadEntry();
    void loadTransactions();
    setLogoRegistry(readAssetLogoRegistry());

    return () => {
      clearHoldingDetailPerformance(measureNames, markNames);
    };
  }, [loadEntry, loadPreferences, loadSidebarPortfolio, loadTransactions, symbol]);

  useEffect(() => {
    if (loading || !entry || process.env.NODE_ENV !== "development") return;

    const trace = traceRef.current;
    if (!trace || trace.symbol !== symbol || trace.reportedEntryReady) return;

    trace.reportedEntryReady = true;

    const frameId = window.requestAnimationFrame(() => {
      const readyAt = window.performance.now();
      const rows = [
        { metric: "Navigation -> page mount", value: formatTraceMetric(trace.navigationStartedAt === null ? null : trace.mountedAt - trace.navigationStartedAt) },
        { metric: "Page mount -> holding ready", value: formatTraceMetric(readyAt - trace.mountedAt) },
        { metric: "Navigation -> holding ready", value: formatTraceMetric(trace.navigationStartedAt === null ? null : readyAt - trace.navigationStartedAt) },
        { metric: "Holding detail fetch", value: formatTraceMetric(trace.entryFetchMs) },
        { metric: "Sidebar portfolio fetch", value: formatTraceMetric(trace.sidebarFetchMs) },
        { metric: "Transactions fetch (current stage)", value: formatTraceMetric(trace.transactionsFetchMs) },
      ];

      console.groupCollapsed(`[HoldingDetail][${symbol}] holding ready`);
      console.table(rows);
      console.groupEnd();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [entry, loading, symbol]);

  useEffect(() => {
    if (transactionsLoading || process.env.NODE_ENV !== "development") return;

    const trace = traceRef.current;
    if (!trace || trace.symbol !== symbol || trace.reportedTransactionsReady) return;

    trace.reportedTransactionsReady = true;

    const frameId = window.requestAnimationFrame(() => {
      const readyAt = window.performance.now();
      const rows = [
        { metric: "Navigation -> transactions ready", value: formatTraceMetric(trace.navigationStartedAt === null ? null : readyAt - trace.navigationStartedAt) },
        { metric: "Page mount -> transactions ready", value: formatTraceMetric(readyAt - trace.mountedAt) },
        { metric: "Transactions fetch", value: formatTraceMetric(trace.transactionsFetchMs) },
        { metric: "Transactions loaded", value: `${transactions.length}` },
      ];

      console.groupCollapsed(`[HoldingDetail][${symbol}] transactions ready`);
      console.table(rows);
      console.groupEnd();

      clearHoldingDetailTrace();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [symbol, transactions.length, transactionsLoading]);

  const sidebarGroups = useMemo(
    () => buildSidebarGroups(portfolioEntries, preferences),
    [portfolioEntries, preferences],
  );
  const totalValue = useMemo(
    () => portfolioEntries.reduce((acc, current) => acc + Number(current.currentValue), 0),
    [portfolioEntries],
  );
  const createdCount = preferences.length > 0 ? preferences.length : sidebarGroups.length;
  const transactionsEnabled = entry ? SUPPORTED_TRANSACTION_TYPES.has(entry.assetType) : false;
  const initialAsset = useMemo<AssetOption | null>(() => {
    if (!entry) return null;

    return {
      assetId: entry.portfolioEntryId,
      symbol: entry.assetSymbol,
      name: getAssetDisplayName(entry.assetSymbol),
      assetType: entry.assetType,
      logoUrl: getAssetLogoFromRegistry(logoRegistry, entry.assetSymbol, entry.assetType),
      supportedForTransactions: true,
      suggestedPrice: Number(entry.lastTransactionPrice || entry.averagePricePerUnit || 0),
    };
  }, [entry, logoRegistry]);

  return (
    <>
      <main className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <PortfolioSidebar
          activeType={entry?.assetType ?? "CRYPTO"}
          createdCount={createdCount}
          groups={sidebarGroups}
          onCreatePortfolio={() => setCreateModalOpen(true)}
          totalValue={totalValue}
        />

        <section className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <button
              className="rounded-full bg-[#111317] px-3.5 py-2 text-[0.8rem] font-semibold text-[#a4afc0] shadow-[0_18px_42px_rgba(0,0,0,0.24)] transition hover:text-white"
              onClick={() => router.push(`/portfolio?type=${entry?.assetType ?? "CRYPTO"}`)}
              type="button"
            >
              Back to portfolio
            </button>
            <div className="flex items-center gap-3">
              <Link className="text-[0.8rem] font-semibold text-[var(--brand)]" href="/transactions">
                Review all transactions
              </Link>
              <button
                className="rounded-full bg-[var(--brand)] px-4 py-2.5 text-[0.8rem] font-semibold text-white shadow-[0_14px_26px_rgba(67,97,238,0.22)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-55"
                disabled={!transactionsEnabled}
                onClick={() => setModalOpen(true)}
                type="button"
              >
                + Add Transaction
              </button>
            </div>
          </div>

          {loading ? <HoldingDetailSkeleton /> : null}
          {!loading && entry ? <PortfolioDetailCard entry={entry} /> : null}
          {!loading && entry ? <AssetChartContainer symbol={entry.assetSymbol} /> : null}
          {!loading && error ? (
            <section className="glass rounded-[1.6rem] p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
              <h1 className="text-[1.35rem] font-bold text-slate-950">Holding unavailable</h1>
              <p className="mt-3 text-[0.84rem] leading-6 text-slate-600">{error}</p>
            </section>
          ) : null}

          {!loading && entry ? (
            <AssetTransactionsSection
              assetSymbol={entry.assetSymbol}
              error={transactionsError}
              loading={transactionsLoading}
              transactions={transactions}
            />
          ) : null}
        </section>
      </main>

      <AddTransactionModal
        initialAsset={initialAsset}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={async () => {
          await loadSidebarPortfolio();
          await loadEntry();
          await loadTransactions();
        }}
        portfolioAssetType={entry?.assetType}
        portfolioName={entry?.assetType}
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

function AssetTransactionsSection({
  assetSymbol,
  error,
  loading,
  transactions,
}: {
  assetSymbol: string;
  error: string | null;
  loading: boolean;
  transactions: TransactionResponse[];
}) {
  return (
    <section className="overflow-hidden rounded-[1.6rem] bg-[#111317] shadow-[0_30px_84px_rgba(0,0,0,0.32)]">
      <div className="flex items-center justify-between border-b border-[#1a1f29] px-5 py-4">
        <div>
          <h2 className="text-[1.15rem] font-semibold text-white">Transactions</h2>
          <p className="mt-1 text-[0.78rem] text-[#7f8aa3]">
            Only {assetSymbol} operations are shown here.
          </p>
        </div>
        <span className="rounded-full bg-[#0f1217] px-3 py-1 text-[0.72rem] font-semibold text-[#8a94a6] shadow-[0_14px_30px_rgba(0,0,0,0.16)]">
          {transactions.length} recorded
        </span>
      </div>

      {loading ? <div className="h-48 animate-pulse bg-[#0d0f13]" /> : null}
      {!loading && error ? (
        <p className="px-5 py-5 text-[0.82rem] text-[#8a94a6]">{error}</p>
      ) : null}
      {!loading && !error && !transactions.length ? (
        <p className="px-5 py-5 text-[0.82rem] text-[#8a94a6]">
          No transactions have been registered for this asset yet.
        </p>
      ) : null}

      {!loading && !error && transactions.length ? (
        <>
          <div className="grid grid-cols-[1.35fr_0.9fr_1fr_0.72fr] gap-4 border-b border-[#1a1f29] px-5 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#71819b]">
            <span>Type</span>
            <span>Price</span>
            <span>Amount</span>
            <span>Fee</span>
          </div>
          <div className="divide-y divide-[#1a1f29]">
            {transactions.map((transaction, index) => {
              const positive =
                transaction.transactionType === "BUY" ||
                transaction.transactionType === "TRANSFER";
              return (
                <div
                  className="grid grid-cols-[1.35fr_0.9fr_1fr_0.72fr] gap-4 px-5 py-3.5 transition hover:bg-white/[0.02]"
                  key={`${transaction.assetSymbol}-${transaction.transactionDate}-${index}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#1b2130] text-[0.68rem] font-semibold text-[#c7cedb]">
                      {transaction.transactionType.slice(0, 1)}
                    </span>
                    <div>
                      <p className="text-[0.88rem] font-semibold text-white">
                        {formatTransactionType(transaction.transactionType)}
                      </p>
                      <p className="mt-0.5 text-[0.74rem] text-[#7f8aa3]">
                        {formatDateTime(transaction.transactionDate)}
                      </p>
                    </div>
                  </div>
                  <div className="text-[0.84rem] font-semibold text-white">
                    {formatCurrency(transaction.pricePerUnit)}
                  </div>
                  <div>
                    <p
                      className={
                        positive
                          ? "text-[0.88rem] font-semibold text-emerald-600"
                          : "text-[0.88rem] font-semibold text-rose-600"
                      }
                    >
                      {positive ? "+" : "-"}
                      {formatCurrency(transaction.totalValue)}
                    </p>
                    <p
                      className={
                        positive
                          ? "mt-0.5 text-[0.74rem] font-medium text-emerald-600"
                          : "mt-0.5 text-[0.74rem] font-medium text-rose-600"
                      }
                    >
                      {positive ? "+" : "-"}
                      {formatQuantity(transaction.quantity)} {transaction.assetSymbol}
                    </p>
                  </div>
                  <div className="text-[0.82rem] font-medium text-[#c7cedb]">
                    {Number(transaction.fee) > 0 ? formatFeeCurrency(transaction.fee) : "--"}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}

function HoldingDetailSkeleton() {
  return (
    <section className="overflow-hidden rounded-[1.65rem] bg-[#111317] p-6 shadow-[0_30px_84px_rgba(0,0,0,0.32)]">
      <div className="animate-pulse">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="h-3 w-28 rounded-full bg-[#1a1f29]" />
            <div className="mt-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-[#171c24]" />
              <div className="space-y-3">
                <div className="h-8 w-52 rounded-full bg-[#171c24]" />
                <div className="h-3 w-32 rounded-full bg-[#141920]" />
              </div>
            </div>
          </div>

          <div className="h-12 w-36 rounded-[1rem] bg-[#171c24]" />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              className="rounded-[1.1rem] bg-[#0d0f13] p-4 shadow-[0_18px_36px_rgba(0,0,0,0.16)]"
              key={index}
            >
              <div className="h-3 w-20 rounded-full bg-[#171c24]" />
              <div className="mt-4 h-6 w-24 rounded-full bg-[#1a1f29]" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTransactionType(value: string) {
  switch (value) {
    case "BUY":
      return "Buy";
    case "SELL":
      return "Sell";
    case "TRANSFER":
      return "Transfer";
    default:
      return value;
  }
}


function getHoldingDetailMarkName(symbol: string, markType: (typeof HOLDING_DETAIL_MEASURE_TYPES)[keyof typeof HOLDING_DETAIL_MEASURE_TYPES]) {
  return `holding-detail:${symbol}:${markType}`;
}

function getHoldingDetailMeasureName(symbol: string, measureType: string) {
  return `holding-detail:${symbol}:${measureType}`;
}

function formatTraceMetric(value: number | null) {
  if (value === null || Number.isNaN(value)) return "n/a";
  return `${value.toFixed(2)} ms`;
}
