"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddTransactionModal, type InitialTransactionDraft } from "@/components/transactions/add-transaction-modal";
import { Modal } from "@/components/ui/modal";
import { ProblemAlert } from "@/components/ui/problem-alert";
import { ApiError } from "@/lib/api/problem-details";
import type { AssetOption } from "@/features/assets/types/asset.types";
import { deleteTransaction, updateTransaction } from "@/features/transactions/api/create-transaction";
import { getTransactionDetails, getUserTransactions } from "@/features/transactions/api/get-transactions";
import type { TransactionDetailsResponse, TransactionResponse, TransferDirection } from "@/features/transactions/types/transaction.types";
import { formatFeeCurrency, formatQuantity } from "@/lib/utils/format";
import { getAssetDisplayName } from "@/lib/utils/asset";
import { type CurrencyCode } from "@/lib/utils/currency";
import { AssetAvatar } from "@/components/shared/AssetAvatar";
import { FrictionBreakdownCard } from "@/components/transactions/friction-breakdown-card";
import { SplitAdjustmentCard } from "@/components/transactions/split-adjustment-card";
import { useSplitPreview } from "@/features/portfolio/hooks/use-split-preview";
import { useAssetLogos } from "@/features/assets/hooks/use-asset-logos";

type TransactionFilter = "ALL" | "BUY" | "SELL" | "TRANSFER";

type AssetActionSummary = {
  key: string;
  symbol: string;
  name: string;
  assetType: string;
  logoUrl: string | null;
  currency: CurrencyCode | null;
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
  // Inline transaction detail (View, Finviz-style S0→S1): clicking a row expands
  // its detail in place. Accordion — only one row open at a time.
  const [expandedDetailId, setExpandedDetailId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<TransactionDetailsResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailReqRef = useRef<string | null>(null);
  const [mobileAssetPanel, setMobileAssetPanel] = useState<AssetActionSummary | null>(null);
  const [activeMobileMenuKey, setActiveMobileMenuKey] = useState<string | null>(null);
  // Desktop inline-edit flow (Finviz-style): a per-row kebab menu (S3) opens an
  // inline editor row (S4) that commits via updateTransaction and collapses (S5).
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineTransferType, setInlineTransferType] = useState<TransferDirection | undefined>(undefined);
  // ADR-0007 edit policy: `source` decides which fields the inline editor exposes
  // (MANUAL = full, imported = notes only). Fetched lazily when Edit opens.
  const [inlineSource, setInlineSource] = useState<string | undefined>(undefined);
  const [inlineEditLoading, setInlineEditLoading] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getUserTransactions({ assetType });
      setTransactions(data);
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

  useEffect(() => {
    if (!openMenuId) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-row-actions='true']")) {
        return;
      }
      setOpenMenuId(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  const assetOptions = useMemo(() => {
    const unique = new Set<string>();
    transactions.forEach((transaction) => unique.add(transaction.assetSymbol.toUpperCase()));
    return Array.from(unique).sort((left, right) => left.localeCompare(right));
  }, [transactions]);

  // Distinct assets in this list, fed to the shared self-healing logo resolver.
  const assetRefs = useMemo(
    () =>
      Array.from(
        new Map(
          transactions.map((t) => [t.assetSymbol.toUpperCase(), { symbol: t.assetSymbol, assetType: t.assetType }]),
        ).values(),
      ),
    [transactions],
  );
  const resolveLogo = useAssetLogos(assetRefs);

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
          name: resolveTransactionName(symbol, transaction.assetName),
          assetType,
          logoUrl: resolveLogo(symbol, assetType, transaction.logoUrl),
          currency: resolveTransactionCurrency(transaction.currency),
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
  }, [filteredTransactions, resolveLogo]);

  function openTransactionEditor(
    transaction: TransactionResponse,
    options?: { transferType?: InitialTransactionDraft["transferType"] },
  ) {
    setDraftAsset({
      assetId: transaction.transactionId || `${transaction.assetSymbol}-${transaction.transactionDate}`,
      symbol: transaction.assetSymbol,
      name: resolveTransactionName(transaction.assetSymbol, transaction.assetName),
      assetType: normalizeTransactionAssetType(transaction.assetType),
      logoUrl: resolveLogo(transaction.assetSymbol, transaction.assetType, transaction.logoUrl),
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

  function startInlineEdit(transaction: TransactionResponse) {
    setOpenMenuId(null);
    setExpandedDetailId(null);
    setInlineTransferType(undefined);
    setInlineSource(undefined);
    setInlineEditId(transaction.transactionId);

    // The list row has neither `source` (ADR-0007 edit policy) nor transferType,
    // so fetch the detail lazily when Edit opens. Financial fields stay locked
    // until this resolves; on failure we default to MANUAL (permissive UI) since
    // the backend still enforces the read-only policy with a 409.
    if (!transaction.transactionId) {
      setInlineSource("MANUAL");
      return;
    }
    const isTransfer = normalizeTransactionMode(transaction.transactionType) === "TRANSFER";
    setInlineEditLoading(true);
    getTransactionDetails(transaction.transactionId)
      .then((details) => {
        setInlineSource(details.source ?? "MANUAL");
        if (isTransfer) setInlineTransferType(normalizeTransferType(details.transferType));
      })
      .catch((error) => {
        console.error("Failed to load transaction edit policy", error);
        setInlineSource("MANUAL");
      })
      .finally(() => setInlineEditLoading(false));
  }

  async function handleInlineSaved() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("portfolio:refresh"));
    }
    await fetchTransactions();
    await onDeleted?.();
    setInlineEditId(null);
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
      setDeleteError("No fue posible eliminar la transacción.");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleDetail(transaction: TransactionResponse) {
    const id = transaction.transactionId;
    if (expandedDetailId === id) {
      setExpandedDetailId(null);
      return;
    }
    // Accordion: opening a detail closes any inline editor and kebab menu.
    setInlineEditId(null);
    setOpenMenuId(null);
    setExpandedDetailId(id);
    setDetailData(null);
    setDetailError(null);
    detailReqRef.current = id;
    if (!id) {
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    getTransactionDetails(id)
      .then((details) => {
        if (detailReqRef.current === id) setDetailData(details);
      })
      .catch((error) => {
        console.error("Failed to load transaction details", error);
        if (detailReqRef.current === id) setDetailError("No fue posible cargar el detalle completo de la transacción.");
      })
      .finally(() => {
        if (detailReqRef.current === id) setDetailLoading(false);
      });
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

        <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="text-left text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#71819b] [box-shadow:inset_0_-1px_0_#1a1f29]">
              <th className="pb-4 pr-4 font-medium">Type</th>
              <th className="px-4 pb-4 font-medium">Date</th>
              <th className="px-4 pb-4 font-medium">Assets</th>
              <th className="px-4 pb-4 text-right font-medium">Price</th>
              <th className="px-4 pb-4 text-right font-medium">Amount</th>
              <th className="px-4 pb-4 text-right font-medium">Fees</th>
              <th className="px-4 pb-4 text-right font-medium">Notes</th>
              <th className="pb-4 pl-4 text-center font-medium">Actions</th>
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
              const txCurrency = resolveTransactionCurrency(transaction.currency);
              const rowKey = transaction.transactionId || `${transaction.assetSymbol}-${transaction.transactionDate}-${index}`;
              const isRowEditing = inlineEditId === transaction.transactionId;
              const isRowDetailOpen = expandedDetailId === transaction.transactionId;
              const isLastRow = index === filteredTransactions.length - 1;

              return (
                <Fragment key={rowKey}>
                <tr
                  aria-expanded={isRowDetailOpen}
                  className={`transition [box-shadow:inset_0_-1px_0_#1a1f29] ${isRowEditing || isRowDetailOpen ? "bg-[#0f1319]" : "hover:bg-white/[0.02]"} ${isRowEditing ? "" : "cursor-pointer"}`}
                  onClick={() => {
                    if (isRowEditing) return;
                    toggleDetail(transaction);
                  }}
                  onKeyDown={(event) => {
                    if (isRowEditing) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleDetail(transaction);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className={`inline-flex transition-transform ${isRowDetailOpen ? "text-[#4f74ff]" : "-rotate-90 text-[#6f7a8f]"}`}
                      >
                        <ChevronDownIcon className="h-3.5 w-3.5" />
                      </span>
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
                      <AssetAvatar assetType={transaction.assetType} symbol={transaction.assetSymbol} logoUrl={resolveLogo(transaction.assetSymbol, transaction.assetType, transaction.logoUrl)} />
                      <div className="min-w-0">
                        <p className="text-[0.86rem] font-medium text-white">{resolveTransactionName(transaction.assetSymbol, transaction.assetName)}</p>
                        <p className="mt-0.5 text-[0.74rem] font-medium text-slate-400">{transaction.assetSymbol.toUpperCase()}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <span className="block text-[0.86rem] font-semibold text-white">
                      {formatMoneyByCurrency(transaction.pricePerUnit, txCurrency)}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <span className={`block text-[0.86rem] font-semibold ${isBuy ? "text-emerald-500" : isSell ? "text-rose-400" : "text-white"}`}>
                      {amountPrefix}{formatQuantity(transaction.quantity)} {transaction.assetSymbol.toUpperCase()}
                    </span>
                    <span className="mt-1 block text-[0.74rem] font-medium text-slate-400">
                      {formatMoneyByCurrency(transaction.totalValue, txCurrency)}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <span className="block text-[0.84rem] font-semibold text-white">
                      {transaction.fee > 0 ? formatMoneyByCurrency(transaction.fee, txCurrency) : "--"}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <span className="inline-block max-w-[160px] truncate text-[0.82rem] font-medium text-white">
                      {noteLabel}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="relative flex items-center justify-center" data-row-actions="true">
                      <button
                        aria-expanded={openMenuId === transaction.transactionId}
                        aria-haspopup="menu"
                        aria-label="Transaction actions"
                        className={`rounded-full p-1.5 transition hover:bg-[#1c2533] hover:text-white ${openMenuId === transaction.transactionId ? "bg-[#1c2533] text-white" : "text-[#8a94a6]"}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setOpenMenuId((current) => (current === transaction.transactionId ? null : transaction.transactionId));
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                        type="button"
                      >
                        <MoreActionsIcon className="h-4 w-4" />
                      </button>
                      {openMenuId === transaction.transactionId ? (
                        <div
                          className={`absolute right-0 z-40 min-w-[150px] overflow-hidden rounded-xl border border-[#262d3a] bg-[#0f1319] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.55)] ${isLastRow ? "bottom-full mb-1" : "top-full mt-1"}`}
                          role="menu"
                        >
                          <button
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.82rem] font-semibold text-[#dce4f2] transition hover:bg-[#171d26] hover:text-white"
                            onClick={(event) => {
                              event.stopPropagation();
                              startInlineEdit(transaction);
                            }}
                            role="menuitem"
                            type="button"
                          >
                            <EditIcon className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.82rem] font-semibold text-[#ff7b8c] transition hover:bg-[#211219] hover:text-[#ff9aa7]"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenMenuId(null);
                              setDeleteError(null);
                              setTransactionToDelete(transaction);
                            }}
                            role="menuitem"
                            type="button"
                          >
                            <DeleteIcon className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
                {isRowDetailOpen && !isRowEditing ? (
                  <tr className="bg-[#0f1319] [box-shadow:inset_0_-1px_0_#1a1f29]">
                    <td className="px-5 py-4" colSpan={8}>
                      <InlineTransactionDetail
                        details={detailData}
                        error={detailError}
                        loading={detailLoading}
                        logoUrl={resolveLogo(transaction.assetSymbol, transaction.assetType, transaction.logoUrl)}
                        transaction={transaction}
                      />
                    </td>
                  </tr>
                ) : null}
                {isRowEditing ? (
                  <InlineTransactionEditor
                    loadingPolicy={inlineEditLoading}
                    onCancel={() => setInlineEditId(null)}
                    onSaved={handleInlineSaved}
                    source={inlineSource}
                    transaction={transaction}
                    transferType={inlineTransferType}
                  />
                ) : null}
                </Fragment>
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
        <p className="text-[0.9rem] font-semibold text-white">No tienes transacciones registradas aún</p>
        <p className="mt-2 text-[0.82rem] text-[#8a94a6]">Agrega una transacción para ver el historial de este portafolio aquí.</p>
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


// Local datetime-local input value ("YYYY-MM-DDTHH:mm") in the viewer's zone.
// updateTransaction re-appends the offset via toOffsetDateTime on submit, so we
// feed it the same local shape the modal's DateTimePicker produced.
function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function sourceLabel(source?: string): string {
  if (source === "DRIVEWEALTH") return "DriveWealth";
  if (source === "GBM_STATEMENT" || source === "GBM_EQUITY") return "GBM";
  return source ?? "importada";
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <rect height="9" rx="2" strokeWidth="1.8" width="14" x="5" y="11" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function EditorField({ label, children, highlight = false, locked = false }: { label: string; children: React.ReactNode; highlight?: boolean; locked?: boolean }) {
  const shell = locked
    ? "border-[#232931] bg-[#14191f] opacity-60"
    : highlight
      ? "border-[#2f4a8a] bg-[#121a2b]"
      : "border-[#232931] bg-[#14191f]";
  return (
    <div className={`rounded-[0.7rem] border px-2.5 py-1.5 ${shell}`}>
      <span className="flex items-center gap-1 text-[0.5625rem] font-bold uppercase tracking-[0.14em] text-[#6f7a8f]">
        {label}
        {locked ? <LockIcon className="h-2.5 w-2.5" /> : null}
      </span>
      <div className="mt-1 flex items-center gap-1.5">{children}</div>
    </div>
  );
}

// S4/S5: in-situ editor rendered as a full-width row beneath the transaction.
// Save commits through updateTransaction with a submit guard so one click is
// exactly one PUT, then onSaved refreshes and collapses the row back to S2.
function InlineTransactionEditor({
  loadingPolicy = false,
  onCancel,
  onSaved,
  source,
  transaction,
  transferType,
}: {
  loadingPolicy?: boolean;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
  source?: string;
  transaction: TransactionResponse;
  transferType?: TransferDirection;
}) {
  const isTransfer = normalizeTransactionType(transaction.transactionType) === "TRANSFER";
  // ADR-0007: imported transactions (DriveWealth / GBM) are the broker's
  // authoritative record — only Notes is editable; financial fields are locked.
  // While the source is still loading we keep them locked (safe default).
  const manual = source === "MANUAL";
  const financialLocked = loadingPolicy || !manual;
  const [quantity, setQuantity] = useState(String(transaction.quantity ?? ""));
  const [price, setPrice] = useState(transaction.pricePerUnit ? String(transaction.pricePerUnit) : "");
  const [fee, setFee] = useState(transaction.fee > 0 ? String(transaction.fee) : "");
  const [notes, setNotes] = useState(transaction.notes ?? "");
  const [date, setDate] = useState(() => toLocalDateTimeInput(transaction.transactionDate));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLInputElement>(null);

  // Focus the first editable field once the edit policy is known.
  useEffect(() => {
    if (loadingPolicy) return;
    (manual ? dateRef : notesRef).current?.focus();
  }, [loadingPolicy, manual]);

  const quantityValue = Number.parseFloat(quantity) || 0;
  const priceValue = Number.parseFloat(price) || 0;
  const feeValue = Number.parseFloat(fee) || 0;
  const totalValue = priceValue * quantityValue;

  async function handleSave() {
    if (submitting || loadingPolicy) return;
    if (manual) {
      if (!(quantityValue > 0)) {
        setError("La cantidad debe ser mayor que cero.");
        return;
      }
      if (!isTransfer && !(priceValue > 0)) {
        setError("El precio no es válido.");
        return;
      }
    }
    setError(null);
    setSubmitting(true);
    try {
      // Imported rows send their original (locked) financial values unchanged, so
      // the backend sees a notes-only edit and accepts it (ADR-0007).
      await updateTransaction(transaction.transactionId, {
        assetSymbol: transaction.assetSymbol,
        assetType: transaction.assetType,
        quantity: quantityValue,
        pricePerUnit: isTransfer ? undefined : priceValue,
        fee: feeValue > 0 ? feeValue : undefined,
        notes: notes.trim() || undefined,
        transactionDate: date,
        transferType: isTransfer ? transferType : undefined,
      });
      await onSaved();
    } catch (updateError) {
      // Backend defense: a financial change on an imported row returns 409.
      if (updateError instanceof ApiError && updateError.status === 409) {
        setError("Registro del broker importado: solo las notas son editables.");
      } else {
        setError(updateError instanceof Error ? updateError.message : "No fue posible actualizar la transacción.");
      }
      setSubmitting(false);
    }
  }

  return (
    <tr className="bg-[#0f1319] [box-shadow:inset_0_-1px_0_#1a1f29]">
      <td className="px-5 py-4" colSpan={8}>
        <div
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              onCancel();
            }
          }}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#3861fb]/35 bg-[#3861fb]/[0.12] px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-[#4f74ff]">
              Editar transacción
            </span>
            <span className="text-[0.84rem] font-semibold text-white">{resolveTransactionName(transaction.assetSymbol, transaction.assetName)}</span>
            <span className="text-[0.74rem] text-[#7f8aa3]">{transaction.assetSymbol.toUpperCase()}</span>
          </div>

          {!loadingPolicy && !manual ? (
            <div className="mb-3 flex items-start gap-2.5 rounded-[0.7rem] border border-[#e8b41f]/30 bg-[#e8b41f]/[0.08] px-3 py-2 text-[0.78rem] text-[#f0d79a]">
              <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#e8b41f]" />
              <p>
                <span className="font-semibold text-[#ffe7b0]">Registro del broker ({sourceLabel(source)}).</span>{" "}
                Es el registro autoritativo importado: solo puedes editar las <span className="font-semibold text-[#ffe7b0]">Notas</span>. Los campos financieros son de solo lectura.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <EditorField label="Date" locked={financialLocked}>
              <input
                className="w-full bg-transparent text-[0.82rem] font-semibold text-white outline-none disabled:cursor-not-allowed disabled:text-[#8a94a6]"
                disabled={financialLocked}
                onChange={(event) => setDate(event.target.value)}
                ref={dateRef}
                type="datetime-local"
                value={date}
              />
            </EditorField>
            {!isTransfer ? (
              <EditorField label="Price / unit" locked={financialLocked}>
                <span className="text-[0.8rem] font-semibold text-[#7f8aa3]">$</span>
                <input
                  className="w-full bg-transparent text-[0.82rem] font-semibold text-white outline-none placeholder:text-[#5f6a7e] disabled:cursor-not-allowed disabled:text-[#8a94a6]"
                  disabled={financialLocked}
                  inputMode="decimal"
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="0.00"
                  step="any"
                  type="number"
                  value={price}
                />
              </EditorField>
            ) : null}
            <EditorField label="Amount (qty)" locked={financialLocked}>
              <input
                className="w-full bg-transparent text-[0.82rem] font-semibold text-white outline-none placeholder:text-[#5f6a7e] disabled:cursor-not-allowed disabled:text-[#8a94a6]"
                disabled={financialLocked}
                inputMode="decimal"
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="0.00"
                step="any"
                type="number"
                value={quantity}
              />
            </EditorField>
            <EditorField label="Fees" locked={financialLocked}>
              <span className="text-[0.8rem] font-semibold text-[#7f8aa3]">$</span>
              <input
                className="w-full bg-transparent text-[0.82rem] font-semibold text-white outline-none placeholder:text-[#5f6a7e] disabled:cursor-not-allowed disabled:text-[#8a94a6]"
                disabled={financialLocked}
                inputMode="decimal"
                onChange={(event) => setFee(event.target.value)}
                placeholder="0.00"
                step="any"
                type="number"
                value={fee}
              />
            </EditorField>
            <EditorField highlight={!loadingPolicy && !manual} label="Notes">
              <input
                className="w-full bg-transparent text-[0.82rem] font-semibold text-white outline-none placeholder:text-[#5f6a7e] disabled:cursor-not-allowed disabled:text-[#8a94a6]"
                disabled={loadingPolicy}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Exchange, memo..."
                ref={notesRef}
                type="text"
                value={notes}
              />
            </EditorField>
          </div>

          <ProblemAlert message={error} />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="mr-auto">
              <p className="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-[#6f7a8f]">Total spent</p>
              <p className="mt-0.5 text-[0.95rem] font-semibold text-white">{formatMoneyByCurrency(totalValue, resolveTransactionCurrency(transaction.currency))}</p>
            </div>
            <button
              className="rounded-[0.7rem] border border-[#232931] bg-[#171d28] px-4 py-2 text-[0.82rem] font-semibold text-[#dce4f2] transition hover:bg-[#20283a] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={submitting}
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-[0.7rem] bg-[#3861fb] px-5 py-2 text-[0.82rem] font-semibold text-white transition hover:bg-[#4f74ff] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={submitting || loadingPolicy}
              onClick={handleSave}
              type="button"
            >
              {submitting ? "Saving…" : loadingPolicy ? "Verificando…" : manual ? "Save" : "Save notes"}
            </button>
          </div>
        </div>
      </td>
    </tr>
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
          <AssetAvatar assetType={asset.assetType} logoUrl={asset.logoUrl} size="sm" symbol={asset.symbol} />
          <div className="min-w-0">
            <p className="truncate text-[0.8125rem] font-medium leading-none text-white">{asset.symbol}</p>
            <p className="mt-0.5 truncate text-[10px] leading-none text-slate-400">{asset.name}</p>
          </div>
        </div>

        <div className="min-w-0 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <MiniSparkline positive={asset.netQuantity >= 0} />
            <p className={`truncate text-[0.75rem] font-medium leading-none ${asset.netQuantity >= 0 ? "text-emerald-400/90" : "text-rose-400/80"}`}>{formatSignedQuantity(asset.netQuantity, asset.symbol)}</p>
          </div>
          <p className="mt-0.5 text-[10px] leading-none text-slate-400">{formatMoneyByCurrency(asset.grossValue, asset.currency)}</p>
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
            label="Agregar transacción"
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
}: {
  asset: AssetActionSummary | null;
  onAddTransaction: (asset: AssetActionSummary) => void;
  onClose: () => void;
  onDeleteTransaction: (transaction: TransactionResponse) => void;
  onEditTransaction: (transaction: TransactionResponse) => void;
  onRegisterTransfer: (asset: AssetActionSummary) => void;
}) {
  const [activeTransactionActionId, setActiveTransactionActionId] = useState<string | null>(null);
  // Inline movement detail (View) inside the panel — replaces the removed
  // TransactionDetailsDialog. Accordion: one movement expanded at a time.
  const [viewTxKey, setViewTxKey] = useState<string | null>(null);
  const [viewDetail, setViewDetail] = useState<TransactionDetailsResponse | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const viewReqRef = useRef<string | null>(null);

  function toggleView(transaction: TransactionResponse, key: string) {
    setActiveTransactionActionId(null);
    if (viewTxKey === key) {
      setViewTxKey(null);
      return;
    }
    setViewTxKey(key);
    setViewDetail(null);
    setViewError(null);
    viewReqRef.current = key;
    if (!transaction.transactionId) {
      setViewLoading(false);
      return;
    }
    setViewLoading(true);
    getTransactionDetails(transaction.transactionId)
      .then((details) => {
        if (viewReqRef.current === key) setViewDetail(details);
      })
      .catch((error) => {
        console.error("Failed to load transaction details", error);
        if (viewReqRef.current === key) setViewError("No fue posible cargar el detalle completo de la transacción.");
      })
      .finally(() => {
        if (viewReqRef.current === key) setViewLoading(false);
      });
  }

  useEffect(() => {
    setActiveTransactionActionId(null);
    setViewTxKey(null);
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
            <AssetAvatar assetType={asset.assetType} logoUrl={asset.logoUrl} size="sm" symbol={asset.symbol} />
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
          <TransactionMetric label={asset.currency ? `Actividad ${asset.currency}` : "Actividad"} value={formatMoneyByCurrency(asset.grossValue, asset.currency)} />
          <TransactionMetric label="Balance neto" value={formatSignedQuantity(asset.netQuantity, asset.symbol)} />
          <TransactionMetric
            label="Ultimo registro"
            value={new Date(asset.lastTransactionAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <ActionPanelButton accent="emerald" label="Agregar transacción" onClick={() => onAddTransaction(asset)} />
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
                      aria-expanded={viewTxKey === actionKey}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                      onClick={() => toggleView(transaction, actionKey)}
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
                        <p className="mt-0.5 text-[0.75rem] text-slate-400">{formatMoneyByCurrency(transaction.totalValue, asset.currency)}</p>
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
                          onClick={() => toggleView(transaction, actionKey)}
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

                  {viewTxKey === actionKey ? (
                    <div className="mt-2 border-t border-[#222b39] pt-3">
                      <InlineTransactionDetail
                        details={viewDetail}
                        error={viewError}
                        loading={viewLoading}
                        logoUrl={asset.logoUrl}
                        transaction={transaction}
                      />
                    </div>
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


function resolveTransactionName(symbol: string, apiName?: string | null): string {
  if (apiName) return apiName;
  return getAssetDisplayName(symbol);
}

// Currency the row was executed in — taken STRICTLY from the backend's stored
// `currency`. Returns null when the transaction has no currency recorded: we do
// NOT guess one from the symbol, so the label always reflects real data.
function resolveTransactionCurrency(currency: string | null | undefined): CurrencyCode | null {
  const normalized = currency?.trim().toUpperCase();
  if (normalized === "MXN" || normalized === "USD") return normalized;
  return null;
}

// Money formatter that appends the currency code next to the amount, mirroring
// the broker receipt ("$41.56 USD", "$1,554.49 MXN"). The code is shown only
// when the row actually has a stored currency; with none, the amount renders
// without a fabricated label.
function formatMoneyByCurrency(value: string | number, currency: CurrencyCode | null): string {
  const amount = typeof value === "string" ? Number(value) : value;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
  return currency ? `$${formatted} ${currency}` : `$${formatted}`;
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
  return new Date(value).toLocaleString("es-MX");
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
            <h3 className="text-[1rem] font-semibold text-white">Eliminar transacción</h3>
            <p className="mt-1 text-[0.8125rem] leading-5 text-[#9aa6bb]">
              Esta acción quitará el movimiento de {transaction.assetSymbol.toUpperCase()}.
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

// S1 detail (View): rendered inline beneath a transaction row (desktop) or a
// movement (mobile panel). Two columns — key facts on the left, friction /
// summary on the right. Read-only; replaces the old TransactionDetailsDialog.
function InlineTransactionDetail({
  details,
  error,
  loading,
  logoUrl,
  transaction,
}: {
  details: TransactionDetailsResponse | null;
  error: string | null;
  loading: boolean;
  logoUrl: string | null;
  transaction: TransactionResponse;
}) {
  const assetSymbol = (details?.assetSymbol ?? transaction.assetSymbol).toUpperCase();
  const detailCurrency = resolveTransactionCurrency(transaction.currency);
  const assetType = details?.assetType ?? transaction.assetType;
  const transactionType = details?.transactionType ?? transaction.transactionType;
  const normalizedType = normalizeTransactionType(transactionType);
  const transactionDate = details?.transactionDate ?? transaction.transactionDate;
  const quantity = details?.quantity ?? transaction.quantity;
  const pricePerUnit = details?.pricePerUnit ?? transaction.pricePerUnit;
  const fee = details?.fee ?? transaction.fee;
  const notes = details?.notes?.trim() ? details.notes : transaction.notes?.trim() ? transaction.notes : "--";
  const summaryValue = resolveSummaryValue(details, transaction, normalizedType);
  // Gross amount = price × qty WITHOUT fees (the principal, not the cost basis).
  const grossAmount = details?.grossAmount ?? transaction.totalValue;
  // With a friction breakdown the card already itemizes gross + fees, so the
  // summary keeps only the "Total invertido" headline; manual entries show all.
  const hasBreakdown = Boolean(details?.frictionBreakdown);

  // ADR-0011: for stock/ETF buys & sells, ask the backend whether a split sits
  // between the trade date and today and, if so, render the post-split
  // equivalence overlay. Read-only; the ledger row stays raw. Inputs are fixed
  // (from the stored tx) so no debounce is needed.
  const splitEligible =
    (normalizeTransactionAssetType(assetType) === "STOCK" ||
      normalizeTransactionAssetType(assetType) === "ETF") &&
    (normalizedType === "BUY" || normalizedType === "SELL") &&
    quantity > 0 &&
    pricePerUnit > 0;
  const { data: splitPreview } = useSplitPreview({
    symbol: details?.assetSymbol ?? transaction.assetSymbol,
    transactionDate,
    quantity,
    pricePerUnit,
    enabled: splitEligible,
    debounceMs: 0,
  });

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-full border border-[#3861fb]/35 bg-[#3861fb]/[0.12] px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-[#4f74ff]">
          Detalle de la transacción
        </span>
        <span className="text-[0.84rem] font-semibold text-white">{resolveTransactionName(transaction.assetSymbol, transaction.assetName)}</span>
        <span className="text-[0.74rem] text-[#7f8aa3]">{assetSymbol}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#3861fb] border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          <div>
            <DetailRow label="Tipo" value={normalizedType === "BUY" ? "Compra" : normalizedType === "SELL" ? "Venta" : "Transferencia"} />
            <DetailRow label="Fecha" value={formatDetailsDate(transactionDate)} />
            <DetailRow
              label={normalizeTransactionAssetType(assetType) === "STOCK" ? "Precio por acción" : "Precio por unidad"}
              value={pricePerUnit > 0 ? formatMoneyByCurrency(pricePerUnit, detailCurrency) : "--"}
            />
            <DetailRow
              label="Cantidad"
              value={(
                <span className="inline-flex items-center gap-2 font-semibold text-white">
                  <AssetAvatar assetType={assetType} logoUrl={logoUrl} symbol={assetSymbol} />
                  <span>{formatQuantity(quantity)} {assetSymbol}</span>
                </span>
              )}
            />
            <DetailRow label="Notas" multiline value={notes} />
          </div>

          <div>
            {normalizedType === "TRANSFER" ? (
              <DetailRow label="Cantidad transferida" value={`${formatQuantity(quantity)} ${assetSymbol}`} />
            ) : (
              <>
                {!hasBreakdown ? (
                  <>
                    <DetailRow label="Comisiones" value={fee > 0 ? formatFeeCurrency(fee, details?.feeCurrency ?? "USD") : "--"} />
                    <DetailRow
                      label={normalizedType === "SELL" ? "Monto bruto recibido" : "Monto bruto"}
                      value={formatMoneyByCurrency(grossAmount, detailCurrency)}
                    />
                  </>
                ) : null}
                <DetailRow
                  label={normalizedType === "SELL" ? "Neto recibido" : "Total invertido"}
                  value={formatMoneyByCurrency(summaryValue, detailCurrency)}
                  highlight
                />
              </>
            )}

            {details?.frictionBreakdown ? (
              <FrictionBreakdownCard
                breakdown={details.frictionBreakdown}
                feeCurrency={details.feeCurrency}
                transactionType={transactionType}
                executionUnitPrice={details.pricePerUnit}
              />
            ) : null}

            {splitPreview ? (
              <SplitAdjustmentCard preview={splitPreview} currency={detailCurrency ?? "USD"} />
            ) : null}
          </div>
        </div>
      )}

      {error ? (
        <div className="mt-4 rounded-[0.95rem] border border-[#ea3943]/30 bg-[#ea3943]/10 px-4 py-3 text-[0.82rem] text-[#ffb0b4]">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  multiline = false,
  highlight = false,
  value,
}: {
  label: string;
  multiline?: boolean;
  highlight?: boolean;
  value: React.ReactNode;
}) {
  return (
    <div className={`border-b border-[#1a1f29] py-4 last:border-b-0 ${multiline ? "space-y-2" : "flex items-center justify-between gap-4"}`}>
      <span className={`text-[0.82rem] font-semibold ${highlight ? "text-[#c4cede]" : "text-[#8a94a6]"}`}>{label}</span>
      <div className={`${multiline ? "" : "text-right"} text-[0.95rem] font-semibold ${highlight ? "text-white" : "text-[#b8c0ce]"}`}>{value}</div>
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
