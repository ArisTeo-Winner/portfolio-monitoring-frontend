"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AddTransactionModal, type InitialTransactionDraft } from "@/components/transactions/add-transaction-modal";
import { Modal } from "@/components/ui/modal";
import type { AssetOption } from "@/features/assets/types/asset.types";
import { getAssetLogoFromRegistry, readAssetLogoRegistry, type AssetLogoRegistry } from "@/features/assets/lib/asset-logo-registry";
import { fetchCoinGeckoCryptoLogoMap, readCoinGeckoCryptoLogoMap } from "@/features/assets/lib/coingecko-crypto-logos";
import { deleteTransaction } from "@/features/transactions/api/create-transaction";
import { getTransactionDetails, getUserTransactions } from "@/features/transactions/api/get-transactions";
import type { TransactionDetailsResponse, TransactionResponse } from "@/features/transactions/types/transaction.types";
import { formatCurrency, formatQuantity } from "@/lib/utils/format";
import { getAssetDisplayName } from "@/lib/utils/asset";
import { AssetAvatar } from "@/components/shared/AssetAvatar";

type TransactionFilter = "ALL" | "BUY" | "SELL" | "TRANSFER";

type AssetActionSummary = {
  key: string;
  symbol: string;
  name: string;
  assetType: string;
  logoUrl: string | null;
  movementCount: number;
  netQuantity: number;
  grossValue: number;
  lastTransactionAt: string;
  lastNote: string | null;
  transactions: TransactionResponse[];
};

export function TransactionsTable({
  assetType,
  onDeleted,
}: {
  assetType?: string;
  onDeleted?: () => void | Promise<void>;
}) {
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [logoRegistry, setLogoRegistry] = useState<AssetLogoRegistry>({});
  const [cryptoLogoMap, setCryptoLogoMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftAsset, setDraftAsset] = useState<AssetOption | null>(null);
  const [draftTransaction, setDraftTransaction] = useState<InitialTransactionDraft | null>(null);
  const [typeFilter, setTypeFilter] = useState<TransactionFilter>("ALL");
  const [assetFilter, setAssetFilter] = useState("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [detailsTransaction, setDetailsTransaction] = useState<TransactionResponse | null>(null);
  const [detailsData, setDetailsData] = useState<TransactionDetailsResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [mobileAssetPanel, setMobileAssetPanel] = useState<AssetActionSummary | null>(null);
  const [activeMobileMenuKey, setActiveMobileMenuKey] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUserTransactions({ assetType });
      setTransactions(data);
      setLogoRegistry(readAssetLogoRegistry());
    } catch (error) {
      console.error("Failed to fetch transactions", error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [assetType]);

  useEffect(() => {
    const handleRefresh = () => {
      void fetchTransactions();
    };

    handleRefresh();

    window.addEventListener("portfolio:refresh", handleRefresh);
    return () => {
      window.removeEventListener("portfolio:refresh", handleRefresh);
    };
  }, [fetchTransactions]);

  useEffect(() => {
    let active = true;
    const cached = readCoinGeckoCryptoLogoMap();
    if (Object.keys(cached).length) {
      setCryptoLogoMap(cached);
    }

    fetchCoinGeckoCryptoLogoMap()
      .then((nextMap) => {
        if (active && Object.keys(nextMap).length) {
          setCryptoLogoMap(nextMap);
        }
      })
      .catch(() => {
        // Keep the table functional with registry/fallback avatars.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!activeMobileMenuKey) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-mobile-asset-actions='true']")) {
        return;
      }
      setActiveMobileMenuKey(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [activeMobileMenuKey]);

  const assetOptions = useMemo(() => {
    const unique = new Set<string>();
    transactions.forEach((transaction) => unique.add(transaction.assetSymbol.toUpperCase()));
    return Array.from(unique).sort((left, right) => left.localeCompare(right));
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesType = typeFilter === "ALL" || normalizeTransactionType(transaction.transactionType) === typeFilter;
      const matchesAsset = assetFilter === "ALL" || transaction.assetSymbol.toUpperCase() === assetFilter;
      return matchesType && matchesAsset;
    });
  }, [assetFilter, transactions, typeFilter]);

  const mobileAssetSummaries = useMemo(() => {
    const grouped = new Map<string, AssetActionSummary>();

    filteredTransactions.forEach((transaction) => {
      const assetType = normalizeTransactionAssetType(transaction.assetType);
      const symbol = transaction.assetSymbol.toUpperCase();
      const key = `${assetType}:${symbol}`;
      const normalizedType = normalizeTransactionType(transaction.transactionType);
      const signedQuantity =
        normalizedType === "BUY" ? Number(transaction.quantity) :
        normalizedType === "SELL" ? -Number(transaction.quantity) :
        0;

      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          symbol,
          name: getAssetDisplayName(symbol),
          assetType,
          logoUrl: resolveTransactionLogo(symbol, transaction.assetType, logoRegistry, cryptoLogoMap),
          movementCount: 0,
          netQuantity: 0,
          grossValue: 0,
          lastTransactionAt: transaction.transactionDate,
          lastNote: transaction.notes?.trim() || null,
          transactions: [],
        });
      }

      const summary = grouped.get(key)!;
      summary.movementCount += 1;
      summary.netQuantity += signedQuantity;
      summary.grossValue += Math.abs(Number(transaction.totalValue) || 0);
      if (new Date(transaction.transactionDate).getTime() >= new Date(summary.lastTransactionAt).getTime()) {
        summary.lastTransactionAt = transaction.transactionDate;
        summary.lastNote = transaction.notes?.trim() || null;
      }
      summary.transactions.push(transaction);
    });

    return Array.from(grouped.values())
      .map((summary) => ({
        ...summary,
        transactions: [...summary.transactions].sort(
          (left, right) => new Date(right.transactionDate).getTime() - new Date(left.transactionDate).getTime(),
        ),
      }))
      .sort((left, right) => new Date(right.lastTransactionAt).getTime() - new Date(left.lastTransactionAt).getTime());
  }, [cryptoLogoMap, filteredTransactions, logoRegistry]);

  function openTransactionEditor(
    transaction: TransactionResponse,
    options?: { transferType?: InitialTransactionDraft["transferType"] },
  ) {
    setDraftAsset({
      assetId: transaction.transactionId || `${transaction.assetSymbol}-${transaction.transactionDate}`,
      symbol: transaction.assetSymbol,
      name: getAssetDisplayName(transaction.assetSymbol),
      assetType: normalizeTransactionAssetType(transaction.assetType),
      logoUrl: resolveTransactionLogo(transaction.assetSymbol, transaction.assetType, logoRegistry, cryptoLogoMap),
      supportedForTransactions: true,
      suggestedPrice: transaction.pricePerUnit,
    });

    setDraftTransaction({
      mode: normalizeTransactionMode(transaction.transactionType),
      transferType: options?.transferType,
      quantity: transaction.quantity,
      pricePerUnit: transaction.pricePerUnit,
      fee: transaction.fee,
      notes: transaction.notes ?? "",
      transactionDate: transaction.transactionDate,
    });

    setEditingId(transaction.transactionId);
    setModalOpen(true);
  }

  function openAssetTransactionForm(assetSummary: AssetActionSummary, mode: InitialTransactionDraft["mode"]) {
    setActiveMobileMenuKey(null);
    setMobileAssetPanel(null);
    setDraftAsset({
      assetId: assetSummary.key,
      symbol: assetSummary.symbol,
      name: assetSummary.name,
      assetType: assetSummary.assetType,
      logoUrl: assetSummary.logoUrl,
      supportedForTransactions: true,
    });
    setDraftTransaction({ mode });
    setEditingId(null);
    setModalOpen(true);
  }

  function openAssetAddForm(assetSummary: AssetActionSummary) {
    setActiveMobileMenuKey(null);
    setMobileAssetPanel(null);
    setDraftAsset({
      assetId: assetSummary.key,
      symbol: assetSummary.symbol,
      name: assetSummary.name,
      assetType: assetSummary.assetType,
      logoUrl: assetSummary.logoUrl,
      supportedForTransactions: true,
    });
    setDraftTransaction(null);
    setEditingId(null);
    setModalOpen(true);
  }

  async function handleEditTransaction(transaction: TransactionResponse) {
    const transactionMode = normalizeTransactionMode(transaction.transactionType);

    if (!transaction.transactionId || transactionMode !== "TRANSFER") {
      openTransactionEditor(transaction);
      return;
    }

    setEditingId(transaction.transactionId);
    try {
      const details = await getTransactionDetails(transaction.transactionId);
      openTransactionEditor(transaction, {
        transferType: normalizeTransferType(details.transferType),
      });
    } catch (error) {
      console.error("Failed to load transaction details", error);
      openTransactionEditor(transaction);
    }
  }

  async function handleDeleteTransaction() {
    if (!transactionToDelete?.transactionId) {
      setDeleteError("This transaction does not expose transactionId yet, so it cannot be removed from the frontend.");
      return;
    }

    setDeletingId(transactionToDelete.transactionId);
    setDeleteError(null);
    try {
      await deleteTransaction(transactionToDelete.transactionId);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("portfolio:refresh"));
      }
      await fetchTransactions();
      await onDeleted?.();
      setTransactionToDelete(null);
    } catch (error) {
      console.error("Failed to delete transaction", error);
      setDeleteError("No fue posible eliminar la transaccion.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleViewTransactionDetails(transaction: TransactionResponse) {
    setDetailsTransaction(transaction);
    setDetailsData(null);
    setDetailsError(null);

    if (!transaction.transactionId) {
      return;
    }

    setDetailsLoading(true);
    try {
      const details = await getTransactionDetails(transaction.transactionId);
      setDetailsData(details);
    } catch (error) {
      console.error("Failed to load transaction details", error);
      setDetailsError("No fue posible cargar el detalle completo de la transaccion.");
    } finally {
      setDetailsLoading(false);
    }
  }

  if (loading) {
    return <TransactionsLoadingState />;
  }

  if (transactions.length === 0) {
    return <TransactionsEmptyState />;
  }

  return (
    <div className="mt-0 bg-transparent px-0 pb-0 pt-0">
      <div className="space-y-3 md:space-y-4">
        <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap items-center gap-1.5 md:gap-3">
              <FilterSelect
                label="All Type"
                onChange={(event) => setTypeFilter(event.target.value as TransactionFilter)}
                value={typeFilter}
              >
                <option value="ALL">All Type</option>
                <option value="BUY">Buy</option>
                <option value="SELL">Sell</option>
                <option value="TRANSFER">Transfer</option>
              </FilterSelect>

              <FilterSelect
                label="All Assets"
                onChange={(event) => setAssetFilter(event.target.value)}
                value={assetFilter}
              >
                <option value="ALL">All Assets</option>
                {assetOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </FilterSelect>
            </div>

          </div>

          <div className="hidden text-[0.76rem] font-medium text-[#8a94a6] md:block">
            Showing {filteredTransactions.length} of {transactions.length} transactions
          </div>
        </div>

        <section className="relative mt-2 overflow-hidden rounded-xl border border-white/5 bg-slate-900/50 md:hidden" data-testid="transactions-list">
          <div className="border-b border-white/5 px-3 py-2.5">
            <h2 className="text-[0.9375rem] font-semibold text-white">Activos con movimientos</h2>
          </div>
          {mobileAssetSummaries.length ? (
            <div className="divide-y divide-white/5">
              {mobileAssetSummaries.map((asset) => (
                <MobileAssetActionRow
                  asset={asset}
                  isMenuOpen={activeMobileMenuKey === asset.key}
                  key={asset.key}
                  onAddTransaction={openAssetAddForm}
                  onMenuToggle={() => setActiveMobileMenuKey((current) => current === asset.key ? null : asset.key)}
                  onOpenPanel={() => {
                    setActiveMobileMenuKey(null);
                    setMobileAssetPanel(asset);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="px-0 py-6 text-[0.8125rem] text-[#7f8aa3]">
              No hay activos disponibles para esta vista.
            </div>
          )}
        </section>

        <div className="hidden overflow-x-auto rounded-lg border border-slate-800/50 shadow-[0_2px_20px_rgba(0,0,0,0.28)] md:block">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-slate-800/50 text-zinc-500 text-xs font-medium bg-zinc-900/40">
              <th className="px-5 py-3.5">Type</th>
              <th className="px-5 py-3.5">Date</th>
              <th className="px-5 py-3.5">Assets</th>
              <th className="px-5 py-3.5 text-right">Price</th>
              <th className="px-5 py-3.5 text-right">Amount</th>
              <th className="px-5 py-3.5 text-right">Fees</th>
              <th className="px-5 py-3.5 text-right">Notes</th>
              <th className="px-5 py-3.5 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredTransactions.map((transaction, index) => {
              const normalizedType = normalizeTransactionType(transaction.transactionType);
              const isBuy = normalizedType === "BUY";
              const isSell = normalizedType === "SELL";
              const dateValue = new Date(transaction.transactionDate);
              const dateLabel = dateValue.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              const timeLabel = dateValue.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
              const amountPrefix = isBuy ? "+" : isSell ? "-" : "";
              const noteLabel = transaction.notes?.trim() ? transaction.notes : "--";

              return (
                <tr
                  className="cursor-pointer border-b border-slate-800/50 transition hover:bg-slate-800/30"
                  key={transaction.transactionId || `${transaction.assetSymbol}-${transaction.transactionDate}-${index}`}
                  onClick={() => void handleViewTransactionDetails(transaction)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void handleViewTransactionDetails(transaction);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <TransactionTypeBadge type={normalizedType} />
                      <span className="text-[0.84rem] font-semibold text-white">
                        {normalizedType === "BUY" ? "Buy" : normalizedType === "SELL" ? "Sell" : "Transfer"}
                      </span>
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="text-[0.82rem] font-medium text-slate-400">
                      {dateLabel}, {timeLabel}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <AssetAvatar symbol={transaction.assetSymbol} logoUrl={resolveTransactionLogo(transaction.assetSymbol, transaction.assetType, logoRegistry, cryptoLogoMap)} />
                      <div className="min-w-0">
                        <p className="text-[0.86rem] font-medium text-white">{getAssetDisplayName(transaction.assetSymbol)}</p>
                        <p className="mt-0.5 text-[0.74rem] font-medium text-slate-400">{transaction.assetSymbol.toUpperCase()}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <span className="block text-[0.86rem] font-semibold text-white">
                      {formatCurrency(transaction.pricePerUnit)}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <span className={`block text-[0.86rem] font-semibold ${isBuy ? "text-emerald-500" : isSell ? "text-rose-400" : "text-white"}`}>
                      {amountPrefix}{formatQuantity(transaction.quantity)} {transaction.assetSymbol.toUpperCase()}
                    </span>
                    <span className="mt-1 block text-[0.74rem] font-medium text-slate-400">
                      {formatCurrency(transaction.totalValue)}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <span className="block text-[0.84rem] font-semibold text-white">
                      {transaction.fee > 0 ? formatCurrency(transaction.fee) : "--"}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <span className="inline-block max-w-[160px] truncate text-[0.82rem] font-medium text-white">
                      {noteLabel}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <IconButton
                        disabled={editingId === transaction.transactionId}
                        label="Edit transaction"
                        onClick={() => handleEditTransaction(transaction)}
                      >
                        <EditIcon className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        disabled={deletingId === transaction.transactionId}
                        label="Delete transaction"
                        onClick={() => {
                          setDeleteError(null);
                          setTransactionToDelete(transaction);
                        }}
                      >
                        <DeleteIcon className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        <div className="hidden flex-col gap-3 border-t border-[#222b39] px-5 py-3.5 text-[0.72rem] font-medium text-[#8a94a6] md:flex md:flex-row md:items-center md:justify-between">
          <div>Showing 1 - {filteredTransactions.length} out of {filteredTransactions.length}</div>
          <div className="flex items-center gap-3">
            <span className="flex h-7 min-w-7 items-center justify-center rounded-[0.55rem] bg-[#3861fb] px-2 text-white">1</span>
            <div className="flex items-center gap-2 rounded-[0.65rem] border border-[#2a3344] bg-[#161d29] px-3 py-1.5">
              <span>Show rows</span>
              <span className="font-semibold text-white">20</span>
            </div>
          </div>
        </div>
      </div>

      <AddTransactionModal
        initialAsset={draftAsset}
        initialDraft={draftTransaction}
        editingTransactionId={editingId}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setDraftAsset(null);
          setDraftTransaction(null);
          setEditingId(null);
        }}
        onCreated={async () => {
          await fetchTransactions();
          await onDeleted?.();
        }}
        suggestedAssets={draftAsset ? [draftAsset] : []}
      />

      <DeleteTransactionDialog
        error={deleteError}
        isDeleting={Boolean(transactionToDelete && deletingId === transactionToDelete.transactionId)}
        isOpen={Boolean(transactionToDelete)}
        onClose={() => {
          if (deletingId) return;
          setDeleteError(null);
          setTransactionToDelete(null);
        }}
        onConfirm={handleDeleteTransaction}
        transaction={transactionToDelete}
      />

      <TransactionDetailsDialog
        details={detailsData}
        error={detailsError}
        isLoading={detailsLoading}
        isOpen={Boolean(detailsTransaction)}
        logoUrl={detailsTransaction ? resolveTransactionLogo(detailsTransaction.assetSymbol, detailsTransaction.assetType, logoRegistry, cryptoLogoMap) : null}
        onClose={() => {
          setDetailsTransaction(null);
          setDetailsData(null);
          setDetailsError(null);
          setDetailsLoading(false);
        }}
        transaction={detailsTransaction}
      />

      <MobileAssetActionPanel
        asset={mobileAssetPanel}
        onAddTransaction={openAssetAddForm}
        onClose={() => setMobileAssetPanel(null)}
        onDeleteTransaction={(transaction) => {
          setMobileAssetPanel(null);
          setDeleteError(null);
          setTransactionToDelete(transaction);
        }}
        onEditTransaction={(transaction) => {
          setMobileAssetPanel(null);
          void handleEditTransaction(transaction);
        }}
        onRegisterTransfer={(asset) => openAssetTransactionForm(asset, "TRANSFER")}
        onViewTransaction={(transaction) => {
          setMobileAssetPanel(null);
          void handleViewTransactionDetails(transaction);
        }}
      />
    </div>
  );
}

function TransactionsLoadingState() {
  return (
    <div className="mt-0 bg-[#121214] px-0 pb-0 pt-0">
      <div className="mb-4 flex items-center justify-between pt-0">
        <div className="flex items-center gap-3">
          <div className="h-[2.6rem] w-[7.75rem] animate-pulse rounded-[0.75rem] bg-[#2b3042]" />
          <div className="h-[2.6rem] w-[8.2rem] animate-pulse rounded-[0.75rem] bg-[#2b3042]" />
        </div>
        <div className="h-4 w-40 animate-pulse rounded-full bg-[#181d26]" />
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-800/60 bg-[#121214]">
        <div className="grid grid-cols-[1.1fr_1.3fr_1.2fr_0.9fr_1fr_0.75fr_0.8fr_0.7fr] gap-4 border-b border-zinc-800/60 bg-zinc-900/40 px-5 py-3.5">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-3 animate-pulse rounded-full bg-[#1d232d]" />
          ))}
        </div>

        <div className="divide-y divide-[#222b39]">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="grid grid-cols-[1.1fr_1.3fr_1.2fr_0.9fr_1fr_0.75fr_0.8fr_0.7fr] gap-4 px-5 py-4" key={index}>
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 animate-pulse rounded-full bg-[#1f2530]" />
                <div className="h-4 w-16 animate-pulse rounded-full bg-[#1b2029]" />
              </div>
              <div className="h-4 w-28 animate-pulse rounded-full bg-[#1b2029]" />
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 animate-pulse rounded-full bg-[#1f2530]" />
                <div className="space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded-full bg-[#1b2029]" />
                  <div className="h-3 w-12 animate-pulse rounded-full bg-[#171c24]" />
                </div>
              </div>
              <div className="ml-auto h-4 w-20 animate-pulse rounded-full bg-[#1b2029]" />
              <div className="ml-auto space-y-2">
                <div className="h-4 w-24 animate-pulse rounded-full bg-[#1b2029]" />
                <div className="h-3 w-16 animate-pulse rounded-full bg-[#171c24]" />
              </div>
              <div className="ml-auto h-4 w-12 animate-pulse rounded-full bg-[#1b2029]" />
              <div className="ml-auto h-4 w-16 animate-pulse rounded-full bg-[#1b2029]" />
              <div className="ml-auto flex gap-2">
                <div className="h-7 w-7 animate-pulse rounded-full bg-[#1b2029]" />
                <div className="h-7 w-7 animate-pulse rounded-full bg-[#1b2029]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TransactionsEmptyState() {
  return (
    <div className="mt-0 bg-[#121214] px-0 pb-0 pt-0">
      <div className="rounded-[1rem] border border-zinc-800/60 bg-[#121214] px-6 py-14 text-center shadow-[0_20px_70px_rgba(0,0,0,0.18)]">
        <p className="text-[0.9rem] font-semibold text-white">No tienes transacciones registradas aun</p>
        <p className="mt-2 text-[0.82rem] text-[#8a94a6]">Agrega una transaccion para ver el historial de este portafolio aqui.</p>
      </div>
    </div>
  );
}

function FilterSelect({
  children,
  label,
  onChange,
  value,
}: {
  children: React.ReactNode;
  label: string;
  onChange: React.ChangeEventHandler<HTMLSelectElement>;
  value: string;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        className="h-8 w-[8.25rem] appearance-none rounded-[0.55rem] border border-[#2a3344] bg-[#242a3a] py-0 pl-2.5 pr-8 text-[0.6875rem] font-semibold text-white outline-none transition hover:bg-[#2c3346] md:h-auto md:w-auto md:rounded-[0.75rem] md:bg-[#2b3042] md:py-2.5 md:pl-3.5 md:pr-10 md:text-[0.82rem]"
        onChange={onChange}
        value={value}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#8a94a6] md:right-3">
        <ChevronDownIcon className="h-2.5 w-2.5 md:h-3.5 md:w-3.5" />
      </span>
    </label>
  );
}

function TransactionTypeBadge({ type }: { type: TransactionFilter }) {
  if (type === "BUY") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#16c784] text-white">
        <ArrowIcon direction="up" className="h-3 w-3" />
      </span>
    );
  }

  if (type === "SELL") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ea3943] text-white">
        <ArrowIcon direction="down" className="h-3 w-3" />
      </span>
    );
  }

  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#3861fb] text-white">
      <TransferIcon className="h-3 w-3" />
    </span>
  );
}


function IconButton({
  children,
  disabled = false,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="rounded-full p-1.5 text-[#8a94a6] transition hover:bg-[#1c2533] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
      type="button"
    >
      {children}
    </button>
  );
}

function MobileAssetActionRow({
  asset,
  isMenuOpen,
  onAddTransaction,
  onMenuToggle,
  onOpenPanel,
}: {
  asset: AssetActionSummary;
  isMenuOpen: boolean;
  onAddTransaction: (asset: AssetActionSummary) => void;
  onMenuToggle: () => void;
  onOpenPanel: () => void;
}) {
  return (
    <div
      className="relative px-3 py-1 transition-colors hover:bg-white/5"
      data-mobile-asset-actions="true"
    >
      <div className="grid h-9 grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_auto] items-center gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <AssetAvatar logoUrl={asset.logoUrl} size="sm" symbol={asset.symbol} />
          <div className="min-w-0">
            <p className="truncate text-[0.8125rem] font-medium leading-none text-white">{asset.symbol}</p>
            <p className="mt-0.5 truncate text-[10px] leading-none text-slate-500">{asset.name}</p>
          </div>
        </div>

        <div className="min-w-0 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <MiniSparkline positive={asset.netQuantity >= 0} />
            <p className={`truncate text-[0.75rem] font-medium leading-none ${asset.netQuantity >= 0 ? "text-emerald-400/90" : "text-rose-400/80"}`}>{formatSignedQuantity(asset.netQuantity, asset.symbol)}</p>
          </div>
          <p className="mt-0.5 text-[10px] leading-none text-slate-500">{formatCurrency(asset.grossValue)}</p>
        </div>

        <button
          aria-expanded={isMenuOpen}
          aria-label={`Abrir acciones para ${asset.symbol}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[0.55rem] bg-[#16213e] text-[#4f7bff] transition hover:bg-[#1b2a4e] hover:text-white"
          onClick={(event) => {
            event.stopPropagation();
            onMenuToggle();
          }}
          type="button"
        >
          <MoreActionsIcon className="h-4 w-4" />
        </button>
      </div>

      {isMenuOpen ? (
        <div
          className="mb-1 mt-1.5 overflow-hidden rounded-2xl border border-[#262d3a] bg-[#101317]"
          data-mobile-asset-actions="true"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MobileRowMenuAction
            icon={<EyeIcon className="h-4 w-4" />}
            label="Ver movimientos"
            onClick={onOpenPanel}
          />
          <MobileRowMenuAction
            icon={<PlusIcon className="h-4 w-4" />}
            label="Agregar transaccion"
            onClick={() => onAddTransaction(asset)}
          />
        </div>
      ) : null}
    </div>
  );
}

function MobileRowMenuAction({
  destructive = false,
  icon,
  label,
  onClick,
}: {
  destructive?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex h-11 w-full items-center gap-3 px-3 text-left text-[0.875rem] font-medium transition ${
        destructive
          ? "text-[#ff7b8c] hover:bg-[#211219] hover:text-[#ff9aa7]"
          : "text-[#dce4f2] hover:bg-[#171d26] hover:text-white"
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      type="button"
    >
      <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function TransactionMetric({
  label,
  truncate = false,
  value,
}: {
  label: string;
  truncate?: boolean;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[#121720] px-2.5 py-2">
      <p className="text-[0.625rem] font-semibold uppercase tracking-[0.05em] text-[#6f7a8f]">{label}</p>
      <p className={`mt-1 text-[0.875rem] font-semibold text-white ${truncate ? "truncate" : ""}`}>{value}</p>
    </div>
  );
}

function MobileAssetActionPanel({
  asset,
  onAddTransaction,
  onClose,
  onDeleteTransaction,
  onEditTransaction,
  onRegisterTransfer,
  onViewTransaction,
}: {
  asset: AssetActionSummary | null;
  onAddTransaction: (asset: AssetActionSummary) => void;
  onClose: () => void;
  onDeleteTransaction: (transaction: TransactionResponse) => void;
  onEditTransaction: (transaction: TransactionResponse) => void;
  onRegisterTransfer: (asset: AssetActionSummary) => void;
  onViewTransaction: (transaction: TransactionResponse) => void;
}) {
  const [activeTransactionActionId, setActiveTransactionActionId] = useState<string | null>(null);

  useEffect(() => {
    setActiveTransactionActionId(null);
  }, [asset?.key]);

  useEffect(() => {
    if (!activeTransactionActionId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveTransactionActionId(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTransactionActionId]);

  if (!asset) return null;

  return (
    <Modal
      hideDefaultCloseButton
      onClose={onClose}
      overlayClassName="bg-[#070a11]/76 backdrop-blur-[6px]"
      panelClassName="max-w-[430px] rounded-2xl border border-[#1f2430] bg-[#111317] px-0 py-0 text-white shadow-none ring-0"
    >
      <div className="px-4 pb-4 pt-3">
        <div className="flex max-h-14 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <AssetAvatar logoUrl={asset.logoUrl} size="sm" symbol={asset.symbol} />
            <div className="min-w-0">
              <p className="truncate text-[1rem] font-semibold text-white">{asset.name}</p>
              <p className="mt-0.5 text-[0.6875rem] uppercase tracking-[0.05em] text-[#7f8aa3]">{asset.symbol}</p>
            </div>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#8a94a6] transition hover:bg-[#1b2130] hover:text-white"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true" className="text-[1.125rem] leading-none">&times;</span>
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <TransactionMetric label="Movimientos" value={`${asset.movementCount}`} />
          <TransactionMetric label="Actividad USD" value={formatCurrency(asset.grossValue)} />
          <TransactionMetric label="Balance neto" value={formatSignedQuantity(asset.netQuantity, asset.symbol)} />
          <TransactionMetric
            label="Ultimo registro"
            value={new Date(asset.lastTransactionAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <ActionPanelButton accent="emerald" label="Agregar transaccion" onClick={() => onAddTransaction(asset)} />
          <ActionPanelButton accent="blue" label="Transferir" onClick={() => onRegisterTransfer(asset)} />
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.05em] text-[#6f7a8f]">Ultimos movimientos</p>
          </div>

          <div className="space-y-1.5">
            {asset.transactions.slice(0, 4).map((transaction, index) => {
              const type = normalizeTransactionType(transaction.transactionType);
              const amountColor =
                type === "BUY" ? "text-emerald-500" :
                type === "SELL" ? "text-rose-400" :
                "text-white";
              const actionKey = transaction.transactionId || `${transaction.assetSymbol}-${transaction.transactionDate}-${index}`;

              return (
                <div
                  className="relative rounded-xl bg-[#121720] px-3 py-2 transition hover:bg-slate-800/30"
                  key={actionKey}
                >
                  <div className="flex min-h-11 items-center justify-between gap-2">
                    <button
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                      onClick={() => onViewTransaction(transaction)}
                      type="button"
                    >
                      <div className="min-w-0">
                        <p className="text-[0.875rem] font-semibold text-white">
                          {type === "BUY" ? "Compra" : type === "SELL" ? "Venta" : "Transferencia"}
                        </p>
                        <p className="mt-0.5 text-[0.6875rem] text-slate-400">
                          {new Date(transaction.transactionDate).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className={`text-[0.875rem] font-semibold ${amountColor}`}>
                          {formatQuantity(transaction.quantity)} {transaction.assetSymbol.toUpperCase()}
                        </p>
                        <p className="mt-0.5 text-[0.75rem] text-slate-400">{formatCurrency(transaction.totalValue)}</p>
                      </div>
                    </button>

                    <button
                      aria-expanded={activeTransactionActionId === actionKey}
                      aria-label={`Abrir acciones del movimiento ${transaction.assetSymbol}`}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#182031] text-[#8ea1bb] transition hover:bg-[#20283b] hover:text-white"
                      onClick={() => setActiveTransactionActionId((current) => current === actionKey ? null : actionKey)}
                      type="button"
                    >
                      <MoreActionsIcon className="h-4 w-4" />
                    </button>
                  </div>

                  {activeTransactionActionId === actionKey ? (
                    <>
                      <button
                        aria-label="Cerrar menu de acciones"
                        className="fixed inset-0 z-[999] bg-black/20"
                        onClick={() => setActiveTransactionActionId(null)}
                        type="button"
                      />
                      <div className="fixed bottom-[6.75rem] left-1/2 z-[1000] w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 overflow-hidden rounded-2xl border border-[#262d3a] bg-[#101317]">
                        <MobileRowMenuAction
                          icon={<EyeIcon className="h-4 w-4" />}
                          label="Ver detalle"
                          onClick={() => {
                            setActiveTransactionActionId(null);
                            onViewTransaction(transaction);
                          }}
                        />
                        <MobileRowMenuAction
                          icon={<EditIcon className="h-4 w-4" />}
                          label="Editar"
                          onClick={() => {
                            setActiveTransactionActionId(null);
                            onEditTransaction(transaction);
                          }}
                        />
                        <MobileRowMenuAction
                          destructive
                          icon={<DeleteIcon className="h-4 w-4" />}
                          label="Eliminar"
                          onClick={() => {
                            setActiveTransactionActionId(null);
                            onDeleteTransaction(transaction);
                          }}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function ActionPanelButton({
  accent,
  label,
  onClick,
}: {
  accent: "emerald" | "rose" | "blue";
  label: string;
  onClick: () => void;
}) {
  const palette =
    accent === "emerald"
      ? "bg-[#173726] text-[#31dd97] hover:bg-[#1d4430]"
      : accent === "rose"
        ? "bg-[#371b22] text-[#ff7b8d] hover:bg-[#432129]"
        : "bg-[#16213e] text-[#82a4ff] hover:bg-[#1b2a4e]";

  return (
    <button
      className={`h-10 rounded-[0.875rem] px-3 text-[0.8125rem] font-semibold transition ${palette}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}


function resolveTransactionLogo(
  symbol: string,
  assetType: string,
  registry: AssetLogoRegistry,
  cryptoLogoMap: Record<string, string>,
) {
  const storedLogo = getAssetLogoFromRegistry(registry, symbol, assetType);
  if (storedLogo) return storedLogo;

  return normalizeTransactionAssetType(assetType) === "CRYPTO"
    ? cryptoLogoMap[symbol.toUpperCase()] ?? null
    : null;
}

function normalizeTransactionMode(transactionType: string): InitialTransactionDraft["mode"] {
  const normalized = transactionType.toUpperCase();
  if (normalized === "SELL") return "SELL";
  if (normalized === "TRANSFER") return "TRANSFER";
  return "BUY";
}

function normalizeTransactionType(transactionType: string): TransactionFilter {
  const normalized = transactionType.toUpperCase();
  if (normalized === "SELL") return "SELL";
  if (normalized === "TRANSFER") return "TRANSFER";
  return "BUY";
}

function normalizeTransactionAssetType(assetType: string) {
  const normalized = assetType.toUpperCase();
  if (normalized === "STOCKS") return "STOCK";
  return normalized;
}

function normalizeTransferType(transferType?: string | null): InitialTransactionDraft["transferType"] | undefined {
  if (!transferType) return undefined;
  const normalized = transferType.toUpperCase();
  if (normalized === "TRANSFER_OUT") return "TRANSFER_OUT";
  if (normalized === "TRANSFER_IN") return "TRANSFER_IN";
  return undefined;
}

function resolveAmountLabel(type: TransactionFilter) {
  if (type === "SELL") return "Total Received";
  if (type === "TRANSFER") return "Transfer Quantity";
  return "Total Spent";
}

function resolveSummaryValue(
  details: TransactionDetailsResponse | null,
  transaction: TransactionResponse,
  type: TransactionFilter,
) {
  if (details?.netAmount !== undefined && details.netAmount !== null) {
    return details.netAmount;
  }

  if (type === "SELL") {
    return Math.max(transaction.totalValue - transaction.fee, 0);
  }

  if (type === "BUY") {
    return transaction.totalValue + transaction.fee;
  }

  return transaction.totalValue;
}

function formatDetailsDate(value: string) {
  return new Date(value).toLocaleString("en-US");
}

function formatSignedQuantity(value: number, symbol: string) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatQuantity(Math.abs(value))} ${symbol.toUpperCase()}`;
}

function ArrowIcon({ className, direction }: { className?: string; direction: "up" | "down" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {direction === "up" ? (
        <path d="M12 19V5m0 0-5 5m5-5 5 5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" />
      ) : (
        <path d="M12 5v14m0 0 5-5m-5 5-5-5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" />
      )}
    </svg>
  );
}

function TransferIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path d="M7 7h10m0 0-3-3m3 3-3 3M17 17H7m0 0 3-3m-3 3 3 3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path d="m16.862 3.487 3.651 3.651M7.5 18.75l4.118-.588a2 2 0 0 0 1.06-.554l8.29-8.29a2.581 2.581 0 0 0-3.65-3.65l-8.29 8.29a2 2 0 0 0-.555 1.06L7.5 18.75Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function DeleteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path d="M4.5 7.5h15M9.5 3.75h5a1 1 0 0 1 1 1V7.5h-7V4.75a1 1 0 0 1 1-1ZM8 10.5v6.75M12 10.5v6.75M16 10.5v6.75M6.75 7.5h10.5v11.25a1.5 1.5 0 0 1-1.5 1.5h-7.5a1.5 1.5 0 0 1-1.5-1.5V7.5Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

function MoreActionsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <circle cx="6.5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="17.5" cy="12" r="1.75" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.75" strokeWidth="1.7" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path d="M12 5.5v13M5.5 12h13" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function DeleteTransactionDialog({
  error,
  isDeleting,
  isOpen,
  onClose,
  onConfirm,
  transaction,
}: {
  error: string | null;
  isDeleting: boolean;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  transaction: TransactionResponse | null;
}) {
  if (!isOpen || !transaction) return null;

  return (
    <Modal
      onClose={onClose}
      overlayClassName="bg-[#0b1020]/78 backdrop-blur-[6px]"
      panelClassName="max-w-[360px] rounded-2xl border border-[#2a3344] bg-[#101317] px-4 py-4 text-white shadow-none ring-0 md:max-w-[430px] md:rounded-[1.35rem] md:px-6 md:py-6 md:shadow-[0_40px_120px_rgba(0,0,0,0.52)]"
    >
      <div className="space-y-4 md:space-y-5 md:pt-4">
        <div className="flex items-start gap-3 pr-8">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#ea3943]/25 bg-[#2a1218] text-[#ff5c68] md:mx-auto md:h-12 md:w-12 md:rounded-full md:bg-[#ea3943]/16">
            <WarningIcon className="h-4 w-4 md:h-7 md:w-7" />
          </div>

          <div className="min-w-0 md:hidden">
            <h3 className="text-[1rem] font-semibold text-white">Eliminar transaccion</h3>
            <p className="mt-1 text-[0.8125rem] leading-5 text-[#9aa6bb]">
              Esta accion quitara el movimiento de {transaction.assetSymbol.toUpperCase()}.
            </p>
          </div>
        </div>

        <div className="space-y-2 text-left md:text-center">
          <h3 className="hidden text-[1.05rem] font-semibold tracking-[-0.02em] text-white md:block">Remove Transaction</h3>
          <p className="hidden text-[0.88rem] leading-6 text-[#b3bdd1] md:block">
            Are you sure you want to remove this {transaction.assetSymbol.toUpperCase()} transaction?
          </p>
          <p className="rounded-xl border border-[#202838] bg-[#151a23] px-3 py-2 text-[0.75rem] text-[#8d99ad] md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-[0.76rem]">
            {new Date(transaction.transactionDate).toLocaleString("en-US")}
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-[#ea3943]/25 bg-[#ea3943]/10 px-3 py-2 text-[0.8125rem] text-[#ffb0b4] md:rounded-[0.95rem] md:px-4 md:py-3 md:text-[0.82rem]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-2 md:space-y-3">
          <button
            className="h-10 w-full rounded-[0.875rem] bg-[#c73542] px-4 text-[0.875rem] font-semibold text-white transition hover:bg-[#df4552] disabled:cursor-not-allowed disabled:opacity-55 md:h-auto md:rounded-[0.9rem] md:py-3 md:text-[0.95rem]"
            disabled={isDeleting}
            onClick={onConfirm}
            type="button"
          >
            {isDeleting ? "Removing..." : "Remove"}
          </button>
          <button
            className="h-10 w-full rounded-[0.875rem] border border-[#273142] bg-[#171d28] px-4 text-[0.875rem] font-semibold text-[#dce4f2] transition hover:bg-[#20283a] disabled:cursor-not-allowed disabled:opacity-55 md:h-auto md:rounded-[0.9rem] md:border-0 md:bg-[#353b4d] md:py-3 md:text-[0.95rem] md:text-white md:hover:bg-[#40485c]"
            disabled={isDeleting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TransactionDetailsDialog({
  details,
  error,
  isLoading,
  isOpen,
  logoUrl,
  onClose,
  transaction,
}: {
  details: TransactionDetailsResponse | null;
  error: string | null;
  isLoading: boolean;
  isOpen: boolean;
  logoUrl: string | null;
  onClose: () => void;
  transaction: TransactionResponse | null;
}) {
  if (!isOpen || !transaction) return null;

  const assetSymbol = (details?.assetSymbol ?? transaction.assetSymbol).toUpperCase();
  const assetType = details?.assetType ?? transaction.assetType;
  const transactionType = details?.transactionType ?? transaction.transactionType;
  const normalizedType = normalizeTransactionType(transactionType);
  const transactionDate = details?.transactionDate ?? transaction.transactionDate;
  const quantity = details?.quantity ?? transaction.quantity;
  const pricePerUnit = details?.pricePerUnit ?? transaction.pricePerUnit;
  const fee = details?.fee ?? transaction.fee;
  const notes = details?.notes?.trim() ? details.notes : transaction.notes?.trim() ? transaction.notes : "--";
  const amountLabel = details?.amountLabel ?? resolveAmountLabel(normalizedType);
  const summaryValue = resolveSummaryValue(details, transaction, normalizedType);

  return (
    <Modal
      hideDefaultCloseButton
      onClose={onClose}
      overlayClassName="bg-[#070a11]/76 backdrop-blur-[6px]"
      panelClassName="max-w-[440px] rounded-[1.35rem] border border-[#1f2430] bg-[#111317] px-0 py-0 text-white shadow-[0_38px_100px_rgba(0,0,0,0.52)] ring-0"
    >
      <div className="px-7 pb-7 pt-7">
        <div className="flex items-center justify-between">
          <h3 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-white">Transaction Details</h3>
          <button
            className="rounded-full p-1.5 text-[#8a94a6] transition hover:bg-[#1b2130] hover:text-white"
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true" className="text-[1.75rem] leading-none">&times;</span>
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#3861fb] border-t-transparent" />
          </div>
        ) : (
          <div className="mt-6 space-y-0">
            <DetailRow label="Type" value={normalizedType === "BUY" ? "Buy" : normalizedType === "SELL" ? "Sell" : "Transfer"} />
            <DetailRow label="Date" value={formatDetailsDate(transactionDate)} />
            <DetailRow
              label={normalizeTransactionAssetType(assetType) === "STOCK" ? "Price Per Share" : "Price Per Coin"}
              value={pricePerUnit > 0 ? formatCurrency(pricePerUnit) : "--"}
            />
            <DetailRow
              label="Quantity"
              value={(
                <span className="inline-flex items-center gap-2 font-semibold text-white">
                  <AssetAvatar logoUrl={logoUrl} symbol={assetSymbol} />
                  <span>{formatQuantity(quantity)} {assetSymbol}</span>
                </span>
              )}
            />
            <DetailRow label="Fees" value={fee > 0 ? formatCurrency(fee) : "--"} />
            <DetailRow
              label={amountLabel}
              value={normalizedType === "TRANSFER" ? `${formatQuantity(quantity)} ${assetSymbol}` : formatCurrency(summaryValue)}
            />
            <DetailRow label="Notes" multiline value={notes} />

            {error ? (
              <div className="mt-4 rounded-[0.95rem] border border-[#ea3943]/30 bg-[#ea3943]/10 px-4 py-3 text-[0.82rem] text-[#ffb0b4]">
                {error}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
  );
}

function DetailRow({
  label,
  multiline = false,
  value,
}: {
  label: string;
  multiline?: boolean;
  value: React.ReactNode;
}) {
  return (
    <div className={`border-b border-[#1a1f29] py-4 last:border-b-0 ${multiline ? "space-y-2" : "flex items-center justify-between gap-4"}`}>
      <span className="text-[0.82rem] font-semibold text-[#8a94a6]">{label}</span>
      <div className={`${multiline ? "" : "text-right"} text-[0.95rem] font-semibold text-white`}>{value}</div>
    </div>
  );
}

function MiniSparkline({ positive }: { positive: boolean }) {
  const color = positive ? "#10b981" : "#fb7185";
  const gradId = positive ? "ms-up" : "ms-dn";
  const linePoints = positive
    ? "0,13 8,9 16,7 24,4 32,1"
    : "0,1 8,4 16,7 24,9 32,13";
  const fillPoints = positive
    ? "0,13 8,9 16,7 24,4 32,1 32,14 0,14"
    : "0,1 8,4 16,7 24,9 32,13 32,14 0,14";

  return (
    <svg className="h-[14px] w-8 shrink-0" viewBox="0 0 32 14" fill="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#${gradId})`} />
      <polyline
        points={linePoints}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 3.75 21 19.5a1.2 1.2 0 0 1-1.05 1.8H4.05A1.2 1.2 0 0 1 3 19.5L12 3.75Z" fill="currentColor" opacity="0.18" />
      <path d="M12 8.25v5.25M12 17.25h.008" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M12 3.75 21 19.5a1.2 1.2 0 0 1-1.05 1.8H4.05A1.2 1.2 0 0 1 3 19.5L12 3.75Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}
