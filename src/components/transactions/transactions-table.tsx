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

type TransactionFilter = "ALL" | "BUY" | "SELL" | "TRANSFER";

export function TransactionsTable({ assetType, onDeleted }: { assetType?: string; onDeleted?: () => void | Promise<void> }) {
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
          <div className="mt-0 bg-[#121214] px-0 pb-0 pt-0">
            {/* Filters */}
            <div className="mb-4 flex items-center justify-between pt-0">
              <div className="flex items-center gap-3">
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

        <div className="text-[0.76rem] font-medium text-[#8a94a6]">
          Showing {filteredTransactions.length} of {transactions.length} transactions
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800/60">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-zinc-800/60 text-zinc-500 text-xs font-medium bg-zinc-900/40">
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
                  className="cursor-pointer border-b border-[#222b39] transition hover:bg-[#151d2a]"
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
                    <div className="text-[0.82rem] font-medium text-[#c7cedb]">
                      {dateLabel}, {timeLabel}
                    </div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <AssetAvatar symbol={transaction.assetSymbol} logoUrl={resolveTransactionLogo(transaction.assetSymbol, transaction.assetType, logoRegistry, cryptoLogoMap)} />
                      <div className="min-w-0">
                        <p className="text-[0.86rem] font-semibold text-white">{getAssetDisplayName(transaction.assetSymbol)}</p>
                        <p className="mt-0.5 text-[0.74rem] font-medium text-[#8a94a6]">{transaction.assetSymbol.toUpperCase()}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <span className="block text-[0.86rem] font-semibold text-white">
                      {formatCurrency(transaction.pricePerUnit)}
                    </span>
                  </td>

                  <td className="px-5 py-4 text-right">
                    <span className={`block text-[0.86rem] font-semibold ${isBuy ? "text-[#16c784]" : isSell ? "text-[#ea3943]" : "text-white"}`}>
                      {amountPrefix}{formatQuantity(transaction.quantity)} {transaction.assetSymbol.toUpperCase()}
                    </span>
                    <span className="mt-1 block text-[0.74rem] font-medium text-white">
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

      <div className="flex flex-col gap-3 border-t border-[#222b39] px-5 py-3.5 text-[0.72rem] font-medium text-[#8a94a6] md:flex-row md:items-center md:justify-between">
        <div>Showing 1 - {filteredTransactions.length} out of {filteredTransactions.length}</div>
        <div className="flex items-center gap-3">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-[0.55rem] bg-[#3861fb] px-2 text-white">1</span>
          <div className="flex items-center gap-2 rounded-[0.65rem] border border-[#2a3344] bg-[#161d29] px-3 py-1.5">
            <span>Show rows</span>
            <span className="font-semibold text-white">20</span>
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
        className="appearance-none rounded-[0.75rem] border border-[#2a3344] bg-[#2b3042] py-2 pl-3.5 pr-10 text-[0.82rem] font-semibold text-white outline-none transition hover:bg-[#32384d]"
        onChange={onChange}
        value={value}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8a94a6]">
        <ChevronDownIcon className="h-3.5 w-3.5" />
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

function AssetAvatar({ logoUrl, symbol }: { logoUrl: string | null; symbol: string }) {
  const [failed, setFailed] = useState(false);
  const initials = symbol.slice(0, 2).toUpperCase();
  const palette = pickAssetPalette(symbol);

  if (logoUrl && !failed) {
    return (
      <img
        alt={symbol}
        className="h-8 w-8 shrink-0 rounded-full bg-[#0f131b] object-cover"
        onError={() => setFailed(true)}
        src={logoUrl}
      />
    );
  }

  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.72rem] font-bold"
      style={{ background: `radial-gradient(circle at 30% 30%, ${palette.highlight}, ${palette.base})`, color: palette.text }}
    >
      {initials}
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
    AAPL: "Apple",
    MSFT: "Microsoft",
    GOOGL: "Alphabet",
    SPY: "SPDR S&P 500 ETF",
    QQQ: "Invesco QQQ Trust",
  };

  return names[key] ?? key;
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
      panelClassName="max-w-[430px] rounded-[1.35rem] border border-[#2a3344] bg-[#1b2230] px-6 py-6 text-white shadow-[0_40px_120px_rgba(0,0,0,0.52)] ring-0"
    >
      <div className="space-y-5 pt-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ea3943]/16 text-[#ea3943]">
          <WarningIcon className="h-7 w-7" />
        </div>

        <div className="space-y-2 text-center">
          <h3 className="text-[1.05rem] font-semibold tracking-[-0.02em] text-white">Remove Transaction</h3>
          <p className="text-[0.88rem] leading-6 text-[#b3bdd1]">
            Are you sure you want to remove this {transaction.assetSymbol.toUpperCase()} transaction?
          </p>
          <p className="text-[0.76rem] text-[#7f8aa3]">
            {new Date(transaction.transactionDate).toLocaleString("en-US")}
          </p>
        </div>

        {error ? (
          <div className="rounded-[0.95rem] border border-[#ea3943]/25 bg-[#ea3943]/10 px-4 py-3 text-[0.82rem] text-[#ffb0b4]">
            {error}
          </div>
        ) : null}

        <div className="space-y-3">
          <button
            className="w-full rounded-[0.9rem] bg-[#3861fb] px-4 py-3 text-[0.95rem] font-semibold text-white transition hover:bg-[#4f74ff] disabled:cursor-not-allowed disabled:opacity-55"
            disabled={isDeleting}
            onClick={onConfirm}
            type="button"
          >
            {isDeleting ? "Removing..." : "Remove"}
          </button>
          <button
            className="w-full rounded-[0.9rem] bg-[#353b4d] px-4 py-3 text-[0.95rem] font-semibold text-white transition hover:bg-[#40485c] disabled:cursor-not-allowed disabled:opacity-55"
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
