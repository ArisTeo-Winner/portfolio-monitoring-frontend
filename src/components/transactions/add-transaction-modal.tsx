"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { CryptoSelector } from "@/components/transactions/cryptoSelector";
import { Modal } from "@/components/ui/modal";
import { ProblemAlert } from "@/components/ui/problem-alert";
import type { AssetOption } from "@/features/assets/types/asset.types";
import { getAssetLogoFromRegistry, readAssetLogoRegistry, rememberAssetLogo, type AssetLogoRegistry } from "@/features/assets/lib/asset-logo-registry";
import { searchAssets } from "@/features/assets/api/search-assets";
import { resolveMarketSymbolCandidate } from "@/features/assets/api/resolve-market-symbol";
import { getAssetPrice } from "@/features/marketdata/api/get-asset-price";
import { createBuyTransaction, createSellTransaction, createTransferTransaction, updateTransaction } from "@/features/transactions/api/create-transaction";
import type { TransactionMode, TransferDirection } from "@/features/transactions/types/transaction.types";
import { calculateBuyTotal, calculateSellTotal } from "@/features/transactions/utils/totals";
import { formatCurrency, formatFeeCurrency } from "@/lib/utils/format";
import { normalizeAssetType } from "@/lib/utils/asset";
import { AssetAvatar } from "@/components/shared/AssetAvatar";

const POPULAR_ASSETS: AssetOption[] = [
  { assetId: "btc", symbol: "BTC", name: "Bitcoin", assetType: "CRYPTO", logoUrl: null, supportedForTransactions: true },
  { assetId: "eth", symbol: "ETH", name: "Ethereum", assetType: "CRYPTO", logoUrl: null, supportedForTransactions: true },
  { assetId: "sol", symbol: "SOL", name: "Solana", assetType: "CRYPTO", logoUrl: null, supportedForTransactions: true },
  { assetId: "bnb", symbol: "BNB", name: "BNB", assetType: "CRYPTO", logoUrl: null, supportedForTransactions: true },
  { assetId: "aapl", symbol: "AAPL", name: "Apple Inc.", assetType: "STOCK", logoUrl: null, supportedForTransactions: true },
  { assetId: "msft", symbol: "MSFT", name: "Microsoft Corporation", assetType: "STOCK", logoUrl: null, supportedForTransactions: true },
  { assetId: "googl", symbol: "GOOGL", name: "Alphabet Inc.", assetType: "STOCK", logoUrl: null, supportedForTransactions: true },
  { assetId: "spy", symbol: "SPY", name: "SPDR S&P 500 ETF", assetType: "ETF", logoUrl: null, supportedForTransactions: true },
  { assetId: "qqq", symbol: "QQQ", name: "Invesco QQQ Trust", assetType: "ETF", logoUrl: null, supportedForTransactions: true },
];
const EMPTY_SUGGESTED_ASSETS: AssetOption[] = [];

const SELECTOR_FILTERS = ["ALL", "CRYPTO", "STOCK", "ETF", "INDEX"] as const;
type SelectorFilter = (typeof SELECTOR_FILTERS)[number];
type ModalView = "type" | "form" | "asset" | "fee" | "notes";

export type InitialTransactionDraft = {
  mode: TransactionMode;
  transferType?: TransferDirection;
  quantity?: number;
  pricePerUnit?: number;
  fee?: number;
  notes?: string;
  transactionDate?: string;
};

type AddTransactionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
  suggestedAssets?: AssetOption[];
  portfolioAssetType?: string;
  portfolioName?: string;
  initialAsset?: AssetOption | null;
  initialDraft?: InitialTransactionDraft | null;
  requireAssetTypeSelection?: boolean;
  editingTransactionId?: string | null;
};

export function AddTransactionModal({ isOpen, onClose, onCreated, suggestedAssets = EMPTY_SUGGESTED_ASSETS, portfolioAssetType, portfolioName, initialAsset = null, initialDraft = null, requireAssetTypeSelection = false, editingTransactionId = null }: AddTransactionModalProps) {
  const isEditing = Boolean(editingTransactionId);
  const lockedAssetType = portfolioAssetType ? normalizeAssetType(portfolioAssetType) : undefined;
  const initialFilter = ((initialAsset?.assetType ? normalizeAssetType(initialAsset.assetType) : undefined) ?? lockedAssetType ?? "ALL") as SelectorFilter;
  const shouldSelectAssetTypeFirst = requireAssetTypeSelection && !lockedAssetType && !initialAsset && !initialDraft;
  const totalSteps = shouldSelectAssetTypeFirst ? 3 : 2;
  const [logoRegistry, setLogoRegistry] = useState<AssetLogoRegistry>({});
  const mergedSuggestions = useMemo(() => {
    return buildMergedSuggestions(suggestedAssets, logoRegistry);
  }, [logoRegistry, suggestedAssets]);

  const [view, setView] = useState<ModalView>(shouldSelectAssetTypeFirst ? "type" : initialAsset || initialDraft ? "form" : "asset");
  const [mode, setMode] = useState<TransactionMode>("BUY");
  const [transferType, setTransferType] = useState<TransferDirection>("TRANSFER_IN");
  const [selectedFilter, setSelectedFilter] = useState<SelectorFilter>(initialFilter);
  const [selectedAsset, setSelectedAsset] = useState<AssetOption | null>(initialAsset);
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [fee, setFee] = useState("");
  const [notes, setNotes] = useState("");
  const [transactionDate, setTransactionDate] = useState(createDefaultDateTime());
  const [selectorQuery, setSelectorQuery] = useState("");
  const [selectorResults, setSelectorResults] = useState<AssetOption[]>([]);
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableFilterTypes = useMemo(() => {
    const discovered = new Set<SelectorFilter>();
    mergedSuggestions.forEach((asset) => {
      const normalized = normalizeAssetType(asset.assetType);
      if (normalized && normalized !== "ALL") discovered.add(normalized as SelectorFilter);
    });
    const ordered = SELECTOR_FILTERS.filter((option) => option === "ALL" || discovered.has(option));
    return lockedAssetType ? ordered.filter((option) => option === lockedAssetType) : ordered;
  }, [lockedAssetType, mergedSuggestions]);

  useEffect(() => {
    if (!isOpen) return;
    setLogoRegistry(readAssetLogoRegistry());
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const registry = readAssetLogoRegistry();
    const nextFilter = (lockedAssetType ?? "ALL") as SelectorFilter;
    const nextSuggestions = buildMergedSuggestions(suggestedAssets, registry);
    const hydratedInitialAsset = initialAsset
      ? {
          ...initialAsset,
          logoUrl: initialAsset.logoUrl ?? getAssetLogoFromRegistry(registry, initialAsset.symbol, initialAsset.assetType),
        }
      : null;
    const defaultAsset = hydratedInitialAsset ?? filterAssetsByType(nextSuggestions, nextFilter)[0] ?? null;
    setView(shouldSelectAssetTypeFirst ? "type" : initialAsset || initialDraft ? "form" : "asset");
    setMode(initialDraft?.mode ?? "BUY");
    setTransferType(initialDraft?.transferType ?? "TRANSFER_IN");
    setSelectedFilter(nextFilter);
    setSelectedAsset(shouldSelectAssetTypeFirst ? null : defaultAsset);
    setQuantity(initialDraft?.quantity !== undefined ? formatEditableNumber(initialDraft.quantity) : "");
    setPricePerUnit(initialDraft?.pricePerUnit !== undefined ? formatEditableNumber(initialDraft.pricePerUnit) : !shouldSelectAssetTypeFirst && defaultAsset?.suggestedPrice ? formatEditableNumber(defaultAsset.suggestedPrice) : "");
    setFee(initialDraft?.fee !== undefined && initialDraft.fee > 0 ? formatEditableNumber(initialDraft.fee) : "");
    setNotes(initialDraft?.notes ?? "");
    setTransactionDate(initialDraft?.transactionDate ? toLocalDateTimeInput(initialDraft.transactionDate) : createDefaultDateTime());
    setSelectorQuery("");
    setSelectorResults(filterAssetsByType(nextSuggestions, nextFilter));
    setError(null);
  }, [initialAsset, initialDraft, isOpen, lockedAssetType, shouldSelectAssetTypeFirst, suggestedAssets]);

  useEffect(() => {
    if (!isOpen || !selectedAsset || mode === "TRANSFER") {
      if (mode === "TRANSFER") setPricePerUnit("");
      return;
    }
    if (pricePerUnit) return;
    let active = true;
    setPriceLoading(true);
    getAssetPrice(selectedAsset.symbol, selectedAsset.assetType).then((value) => {
      if (active) setPricePerUnit(formatEditableNumber(value));
    }).catch(() => {
      if (active && !selectedAsset.suggestedPrice) setError(`No fue posible cargar el precio actual de ${selectedAsset.symbol}.`);
    }).finally(() => {
      if (active) setPriceLoading(false);
    });
    return () => {
      active = false;
    };
  }, [isOpen, mode, pricePerUnit, selectedAsset]);

  useEffect(() => {
    if (!isOpen || view !== "asset") return;
    const activeFilter = lockedAssetType ?? selectedFilter;
    const localMatches = filterAssetsByType(
      mergedSuggestions.filter((asset) => matchesAssetQuery(asset, selectorQuery)),
      activeFilter,
    );
    if (!selectorQuery.trim()) {
      setSelectorResults(filterAssetsByType(mergedSuggestions, activeFilter));
      setSelectorLoading(false);
      return;
    }
    setSelectorResults(localMatches);
    let active = true;
    setSelectorLoading(true);
    const timer = setTimeout(() => {
      searchAssets(selectorQuery)
        .then(async (results) => {
          const mergedResults = mergeAssetOptions([
            ...localMatches,
            ...filterAssetsByType(results, activeFilter),
          ]);

          if (mergedResults.length || !supportsDirectSymbolLookup(activeFilter)) {
            return mergedResults;
          }

          const directCandidate = await resolveMarketSymbolCandidate(selectorQuery, activeFilter);
          return directCandidate ? mergeAssetOptions([...localMatches, directCandidate]) : mergedResults;
        })
        .then((results) => {
          if (active) {
            setSelectorResults(results);
          }
        })
        .catch(() => {
          if (active) setSelectorResults(localMatches);
        })
        .finally(() => {
          if (active) setSelectorLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, view, selectorQuery, mergedSuggestions, lockedAssetType, selectedFilter]);

  const quantityValue = parseDecimal(quantity);
  const priceValue = parseDecimal(pricePerUnit);
  const feeValue = parseDecimal(fee);
  const totalValue = mode === "SELL" ? calculateSellTotal(quantityValue, priceValue, feeValue) : calculateBuyTotal(quantityValue, priceValue, feeValue);
  const totalLabel = mode === "SELL" ? "Total Received" : mode === "TRANSFER" ? "Transfer Quantity" : "Total Spent";
  const submitLabel = isEditing ? "Edit Transaction" : mode === "BUY" ? "Add Transaction" : mode === "SELL" ? "Record Sale" : "Record Transfer";
  const submitDisabled = submitting || !selectedAsset || quantityValue <= 0 || !transactionDate || (mode !== "TRANSFER" && (priceLoading || priceValue <= 0));
  const selectorFilters = lockedAssetType
    ? [lockedAssetType as SelectorFilter]
    : availableFilterTypes.includes(selectedFilter)
      ? availableFilterTypes
      : [selectedFilter, ...availableFilterTypes.filter((filter) => filter !== selectedFilter)];
  const typeSelectionFilters = lockedAssetType ? [lockedAssetType as SelectorFilter] : SELECTOR_FILTERS.filter((filter) => filter !== "ALL");
  const portfolioLabel = portfolioName ?? getPortfolioLabel(((initialAsset?.assetType ? normalizeAssetType(initialAsset.assetType) : undefined) as SelectorFilter | undefined) ?? (lockedAssetType as SelectorFilter | undefined) ?? selectedAsset?.assetType ?? selectedFilter);
  const activeSelectorFilter = (lockedAssetType as SelectorFilter | undefined) ?? selectedFilter;
  const assetFieldType = (selectedAsset?.assetType ? normalizeAssetType(selectedAsset.assetType) : undefined) ?? lockedAssetType ?? selectedFilter;
  const formTitle = isEditing ? "Edit Transaction" : "Add Transaction";
  const formDescription = isEditing
    ? "Actualiza los datos de la operacion."
    : `Paso ${shouldSelectAssetTypeFirst ? totalSteps : 2} de ${totalSteps}. Completa los datos de la operacion.`;

  if (!isOpen) return null;

  async function handleSubmit() {
    if (!selectedAsset) return setError("Selecciona un activo antes de registrar la transaccion.");
    if (quantityValue <= 0) return setError("La cantidad debe ser mayor que cero.");
    if (mode !== "TRANSFER" && priceValue <= 0) return setError("No hay precio valido para completar la transaccion.");
    setSubmitting(true);
    setError(null);
    try {
      rememberAssetLogo(selectedAsset);
      if (isEditing && editingTransactionId) {
        await updateTransaction(editingTransactionId, {
          assetSymbol: selectedAsset.symbol,
          assetType: selectedAsset.assetType,
          quantity: quantityValue,
          pricePerUnit: mode === "TRANSFER" ? undefined : priceValue,
          fee: feeValue || undefined,
          notes: notes.trim() || undefined,
          transactionDate,
          transferType: mode === "TRANSFER" ? transferType : undefined,
        });
      } else if (mode === "BUY") {
        await createBuyTransaction({ assetSymbol: selectedAsset.symbol, assetType: selectedAsset.assetType, quantity: quantityValue, pricePerUnit: priceValue, fee: feeValue || undefined, transactionDate, notes: notes.trim() || undefined });
      } else if (mode === "SELL") {
        await createSellTransaction({ assetSymbol: selectedAsset.symbol, assetType: selectedAsset.assetType, quantity: quantityValue, pricePerUnit: priceValue, fee: feeValue || undefined, transactionDate, notes: notes.trim() || undefined });
      } else {
        await createTransferTransaction({ assetSymbol: selectedAsset.symbol, assetType: selectedAsset.assetType, transferType, quantity: quantityValue, fee: feeValue || undefined, transactionDate, notes: notes.trim() || undefined });
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("portfolio:refresh"));
      }
      await onCreated?.();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : isEditing ? "No fue posible actualizar la transaccion." : "No fue posible registrar la transaccion.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleAssetSelect(asset: AssetOption) {
    rememberAssetLogo(asset);
    setLogoRegistry(readAssetLogoRegistry());
    setSelectedAsset(asset);
    setPricePerUnit(asset.suggestedPrice ? formatEditableNumber(asset.suggestedPrice) : "");
    setSelectorQuery("");
    setSelectorResults(filterAssetsByType(mergedSuggestions, lockedAssetType ?? selectedFilter));
    setView("form");
  }

  function handleAssetTypeSelect(filter: SelectorFilter) {
    setSelectedFilter(filter);
    setSelectorQuery("");
    setSelectorResults(filterAssetsByType(mergedSuggestions, filter));
    setSelectedAsset(null);
    setPricePerUnit("");
    setError(null);
    setView("asset");
  }

  return (
    <Modal onClose={view === "asset" ? undefined : onClose} overlayClassName="bg-[#04070d]/84 backdrop-blur-[8px]" panelClassName={view === "asset" ? "max-h-[90vh] max-w-[608px] overflow-hidden rounded-[0.9rem] border border-[#1e232b] bg-[radial-gradient(circle_at_top,rgba(20,23,28,0.98),rgba(10,12,16,0.99)_72%)] px-0 py-0 text-white shadow-[0_28px_72px_rgba(0,0,0,0.5)] ring-0 md:rounded-[1.15rem] md:shadow-[0_40px_120px_rgba(0,0,0,0.62)]" : "max-h-[90vh] max-w-[430px] overflow-y-auto rounded-[0.9rem] border border-[#1e232b] bg-[radial-gradient(circle_at_top,rgba(20,23,28,0.98),rgba(10,12,16,0.99)_72%)] px-3 py-3 text-white shadow-[0_24px_72px_rgba(0,0,0,0.48)] ring-0 md:rounded-[1.05rem] md:px-4 md:py-4 md:shadow-[0_32px_96px_rgba(0,0,0,0.54)]"}>
      {view === "type" ? <AssetTypeSelectionView filters={typeSelectionFilters} onClose={onClose} onSelect={handleAssetTypeSelect} /> : null}
      {view === "asset" ? <AssetSelectorView activeFilter={activeSelectorFilter} assets={selectorResults} filters={selectorFilters} loading={selectorLoading} lockedAssetType={lockedAssetType} onBack={selectedAsset ? () => setView("form") : shouldSelectAssetTypeFirst ? () => setView("type") : undefined} onClose={onClose} onFilterChange={setSelectedFilter} onQueryChange={setSelectorQuery} onSelect={handleAssetSelect} portfolioLabel={portfolioLabel} query={selectorQuery} showFilterTabs={!shouldSelectAssetTypeFirst && !lockedAssetType} stepLabel={shouldSelectAssetTypeFirst ? "Paso 2 de 3" : "Paso 1 de 2"} /> : null}
      {view === "fee" ? <SimpleEditor title="Add Fee" cta="Apply Fee" onBack={() => setView("form")} stepLabel={shouldSelectAssetTypeFirst ? `Paso ${totalSteps} de ${totalSteps}` : "Paso 2 de 2"}><Field label="Fee"><div className="flex items-center gap-2.5"><span className="text-[0.875rem] font-semibold text-[#7f8aa3] md:text-[1rem]">$</span><input className="w-full bg-transparent text-[0.875rem] font-semibold text-white outline-none placeholder:text-[#6f7a8f] md:text-[1.35rem] md:tracking-[-0.03em]" inputMode="decimal" onChange={(event) => setFee(event.target.value)} placeholder="0.00" step="any" type="number" value={fee} /></div></Field></SimpleEditor> : null}
      {view === "notes" ? <SimpleEditor title="Add Notes" cta="Save Notes" onBack={() => setView("form")} stepLabel={shouldSelectAssetTypeFirst ? `Paso ${totalSteps} de ${totalSteps}` : "Paso 2 de 2"}><Field label="Notes"><textarea className="min-h-24 w-full resize-none bg-transparent text-[0.875rem] leading-5 text-white outline-none placeholder:text-[#6f7a8f] md:min-h-32 md:text-[0.95rem] md:leading-7" maxLength={255} onChange={(event) => setNotes(event.target.value)} placeholder="Exchange, source wallet, memo, reasoning..." value={notes} /></Field></SimpleEditor> : null}
      {view === "form" ? <div className="space-y-3 md:space-y-5"><header className="pr-8 md:space-y-1.5 md:border-b md:border-[#1b2028] md:pb-4"><p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.68rem] md:tracking-[0.18em]">{portfolioLabel} portfolio</p><h2 className="text-[1.125rem] font-semibold text-white md:text-[1.38rem] md:tracking-[-0.03em]">{formTitle}</h2><p className="hidden text-sm text-[#7f8aa3] md:block">{formDescription}</p></header>{!isEditing ? <div className="rounded-xl border border-[#1b2028] bg-[#101418] p-1 md:rounded-[0.9rem]"><div className="grid grid-cols-3 gap-1">{(["BUY", "SELL", "TRANSFER"] as TransactionMode[]).map((tab) => { const active = mode === tab; return <button className={active ? "h-7 rounded-xl border border-[#2a313b] bg-[#1a2028] px-3 text-[0.8125rem] font-semibold text-white md:h-auto md:rounded-[0.72rem] md:px-2 md:py-2 md:text-[0.78rem]" : "h-7 rounded-xl px-3 text-[0.8125rem] font-semibold text-[#6f7a8f] transition hover:bg-[#151a21] hover:text-white md:h-auto md:rounded-[0.72rem] md:px-2 md:py-2 md:text-[0.78rem]"} key={tab} onClick={() => setMode(tab)} type="button">{tab === "BUY" ? "Buy" : tab === "SELL" ? "Sell" : "Transfer"}</button>; })}</div></div> : null}{mode === "TRANSFER" ? <div className="rounded-xl border border-[#1b2028] bg-[#101418] p-1 md:rounded-[0.95rem]"><div className="grid grid-cols-2 gap-1 md:gap-2">{(["TRANSFER_IN", "TRANSFER_OUT"] as TransferDirection[]).map((option) => { const active = transferType === option; return <button className={active ? "h-7 rounded-xl border border-[#2a313b] bg-[#1a2028] px-3 text-[0.8125rem] font-semibold text-white md:h-auto md:rounded-[0.85rem] md:px-4 md:py-2.5 md:text-sm" : "h-7 rounded-xl px-3 text-[0.8125rem] font-semibold text-[#6f7a8f] transition hover:bg-[#151a21] hover:text-white md:h-auto md:rounded-[0.85rem] md:px-4 md:py-2.5 md:text-sm"} key={option} onClick={() => setTransferType(option)} type="button">{option === "TRANSFER_IN" ? "Transfer In" : "Transfer Out"}</button>; })}</div></div> : null}<button className={`flex min-h-11 w-full items-center justify-between rounded-[0.875rem] border border-[#232931] bg-[#14191f] px-3 py-2 text-left md:rounded-[0.95rem] md:py-3 ${isEditing ? "cursor-default" : "transition hover:border-[#2f3742] hover:bg-[#181d24]"}`} disabled={isEditing} onClick={() => !isEditing && setView("asset")} type="button"><div className="flex items-center gap-3"><AssetAvatar symbol={selectedAsset?.symbol ?? "?"} logoUrl={selectedAsset?.logoUrl ?? null} /><div><p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.72rem]">Asset</p><div className="mt-0.5 flex items-baseline gap-2 md:mt-1"><span className="text-[0.875rem] font-medium text-white md:text-[0.95rem]">{selectedAsset?.name ?? "Select Asset"}</span><span className="text-[0.75rem] text-[#7f8aa3] md:text-[0.76rem]">{selectedAsset?.symbol ?? getFilterLabel(lockedAssetType ?? selectedFilter)}</span></div></div></div>{!isEditing ? <span className="text-[1rem] leading-none text-[#7f8aa3] md:text-[1.1rem]">&rsaquo;</span> : null}</button><div className="grid gap-3 md:grid-cols-2"><Field label="Quantity"><input className="w-full bg-transparent text-[0.875rem] font-semibold text-white outline-none placeholder:text-[#6f7a8f] md:text-[1rem] md:tracking-[-0.03em]" inputMode="decimal" onChange={(event) => setQuantity(event.target.value)} placeholder="0.00" step="any" type="number" value={quantity} /></Field><Field label={mode === "TRANSFER" ? "Reference Price" : assetFieldType === "STOCK" ? "Price Per Share" : "Price Per Coin"}><div className="flex items-center gap-2.5"><span className="text-[0.8125rem] font-semibold text-[#7f8aa3] md:text-[0.82rem]">$</span><input className="w-full bg-transparent text-[0.875rem] font-semibold text-white outline-none placeholder:text-[#6f7a8f] disabled:text-[#6f7a8f]/60 md:text-[0.98rem] md:tracking-[-0.03em]" disabled={mode === "TRANSFER"} inputMode="decimal" onChange={(event) => setPricePerUnit(event.target.value)} placeholder={priceLoading ? "Loading..." : "0.00"} step="any" type="number" value={pricePerUnit} /></div></Field></div><div className="grid gap-3 md:grid-cols-[1.45fr_0.62fr_0.78fr] md:gap-2"><label className="block rounded-[0.875rem] border border-[#232931] bg-[#14191f] px-3 py-2 md:rounded-[0.95rem] md:py-2.5"><span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.68rem]">Date</span><input className="mt-1 w-full bg-transparent text-[0.875rem] font-medium text-white outline-none md:mt-2 md:text-[0.84rem]" onChange={(event) => setTransactionDate(event.target.value)} type="datetime-local" value={transactionDate} /></label><button className="rounded-[0.875rem] border border-[#232931] bg-[#14191f] px-3 py-2 text-left transition hover:border-[#2f3742] hover:bg-[#181d24] md:rounded-[0.95rem] md:py-2.5" onClick={() => setView("fee")} type="button"><span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.68rem]">Fee</span><p className="mt-1 text-[0.875rem] font-medium text-white md:mt-2 md:text-[0.84rem]">{feeValue > 0 ? formatFeeCurrency(feeValue) : "Add fee"}</p></button><button className="rounded-[0.875rem] border border-[#232931] bg-[#14191f] px-3 py-2 text-left transition hover:border-[#2f3742] hover:bg-[#181d24] md:rounded-[0.95rem] md:py-2.5" onClick={() => setView("notes")} type="button"><span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.68rem]">Notes</span><p className="mt-1 line-clamp-2 text-[0.875rem] font-medium text-white md:mt-2 md:text-[0.84rem]">{notes.trim() ? notes : "Add notes"}</p></button></div><ProblemAlert message={error} /><section className="mt-3 bg-transparent px-0 py-0 md:mt-0 md:rounded-[0.95rem] md:border md:border-[#1b2028] md:bg-[#101418] md:px-3.5 md:py-3"><p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.66rem]">{totalLabel}</p><p className="mt-1 text-[1rem] font-semibold text-white md:mt-1.5 md:text-[1.08rem] md:tracking-[-0.04em]">{mode === "TRANSFER" ? `${formatEditableNumber(quantityValue)} ${selectedAsset?.symbol ?? "units"}` : formatCurrency(totalValue)}</p></section><button className={`w-full rounded-[0.82rem] px-4 py-2.5 text-[0.875rem] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-55 md:py-3 md:text-[0.92rem] ${isEditing ? "bg-[#3861fb] hover:bg-[#4f74ff]" : "bg-[#3f8c53] hover:bg-[#4a9b5f]"}`} disabled={submitDisabled} onClick={handleSubmit} type="button">{submitting ? isEditing ? "Saving changes..." : "Saving transaction..." : submitLabel}</button></div> : null}
    </Modal>
  );
}

function AssetTypeSelectionView({ filters, onClose, onSelect }: { filters: SelectorFilter[]; onClose: () => void; onSelect: (filter: SelectorFilter) => void }) {
  return (
    <div>
      <SelectorHeader onClose={onClose} stepLabel="Paso 1 de 3" title="Tipo de Activo" />
      <div className="hidden border-t border-[#1b2028] px-6 pb-6 pt-5 md:block">
        <p className="text-[0.94rem] font-medium text-[#dfe6f5]">Selecciona la clase de activo que deseas registrar:</p>
      </div>
      <div className="grid gap-3 px-4 pb-4 md:px-6 md:pb-6 sm:grid-cols-2">
        {filters.map((filter) => {
          const card = getAssetTypeCard(filter);
          return (
          <button
            className="rounded-[0.875rem] border border-[#232a33] bg-[#14191f] p-3 text-left transition hover:border-[#313a46] hover:bg-[#171c22] md:rounded-[1rem] md:p-4"
            key={filter}
            onClick={() => onSelect(filter)}
            type="button"
          >
            <div className={`mb-3 flex h-7 w-7 items-center justify-center rounded-full md:mb-4 md:h-11 md:w-11 ${card.badgeClassName}`}>
              {card.icon}
            </div>
            <p className="text-[0.875rem] font-semibold text-white md:text-[1rem]">{card.title}</p>
            <p className="mt-1 text-[0.6875rem] leading-4 text-[#7f8aa3] md:mt-1.5 md:text-[0.82rem] md:leading-6">{card.description}</p>
          </button>
        )})}
      </div>
    </div>
  );
}

function AssetSelectorView({ activeFilter, assets, filters, loading, lockedAssetType, onBack, onClose, onFilterChange, onQueryChange, onSelect, portfolioLabel, query, showFilterTabs, stepLabel }: { activeFilter: SelectorFilter; assets: AssetOption[]; filters: SelectorFilter[]; loading: boolean; lockedAssetType?: string; onBack?: () => void; onClose: () => void; onFilterChange: (value: SelectorFilter) => void; onQueryChange: (value: string) => void; onSelect: (asset: AssetOption) => void; portfolioLabel: string; query: string; showFilterTabs: boolean; stepLabel: string }) {
  if (activeFilter === "CRYPTO") return <div><SelectorHeader onBack={onBack} onClose={onClose} stepLabel={stepLabel} title="Seleccionar Activo" /><div className="hidden px-7 pb-7 pt-6 md:block"><p className="text-center text-[1.04rem] font-medium text-white">Selecciona una moneda para registrar tu operacion</p><p className="mt-1 text-center text-sm text-[#6f7a8f]">{portfolioLabel} wallet</p></div><div className="px-4 pb-4 md:px-7 md:pb-7"><CryptoSelector onChange={(crypto) => onSelect({ assetId: crypto.id, symbol: crypto.symbol.toUpperCase(), name: crypto.name, assetType: "CRYPTO", logoUrl: crypto.image ?? `https://assets.coingecko.com/coins/images/1/small/${crypto.id}.png`, supportedForTransactions: true, suggestedPrice: crypto.currentPrice })} value={null} /></div></div>;
  return <div className="flex max-h-[90vh] flex-col md:max-h-[78vh]"><SelectorHeader onBack={onBack} onClose={onClose} stepLabel={stepLabel} title="Seleccionar Activo" /><div className="px-4 pb-3 md:px-7 md:pb-6 md:pt-6"><p className="hidden text-center text-[1.04rem] font-medium text-white md:block">Selecciona un activo para registrar tu operacion</p><p className="mt-1 hidden text-center text-sm text-[#6f7a8f] md:block">{portfolioLabel} wallet</p><div className="mt-0 rounded-[0.875rem] border border-[#252c36] bg-[#14191f] px-3 py-2 md:mt-5 md:rounded-[0.85rem] md:px-4 md:py-3"><div className="flex items-center gap-3"><span className="text-[0.8125rem] text-[#6f7a8f] md:text-sm">Search</span><input className="w-full bg-transparent text-[0.875rem] text-white outline-none placeholder:text-[#6f7a8f] md:text-[0.92rem]" onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar simbolo, empresa o activo" value={query} />{query ? <button className="text-[0.8125rem] font-medium text-[#7f8aa3] transition hover:text-white md:text-sm" onClick={() => onQueryChange("")} type="button">Limpiar</button> : null}</div></div>{showFilterTabs ? <div className="mt-3 flex flex-wrap gap-1.5 md:mt-4 md:gap-2">{filters.map((filter) => { const active = filter === activeFilter; return <button className={active ? "h-7 rounded-xl border border-[#2a313b] bg-[#1a2028] px-3 text-[0.75rem] font-semibold text-white md:h-auto md:rounded-full md:px-3.5 md:py-2 md:text-[0.76rem]" : "h-7 rounded-xl border border-[#1b2028] bg-[#101418] px-3 text-[0.75rem] font-semibold text-[#6f7a8f] transition hover:border-[#2a313b] hover:text-white md:h-auto md:rounded-full md:px-3.5 md:py-2 md:text-[0.76rem]"} disabled={Boolean(lockedAssetType)} key={filter} onClick={() => onFilterChange(filter)} type="button">{getFilterLabel(filter)}</button>; })}</div> : null}</div><div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-7 md:pb-7"><div className="grid grid-cols-[1fr_auto] gap-4 px-2 pb-2 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.72rem]"><span>Activo</span><span>Clase</span></div>{loading ? <p className="px-2 py-4 text-[0.8125rem] text-[#6f7a8f] md:py-5 md:text-sm">Searching assets...</p> : null}{!loading && !assets.length ? <p className="px-2 py-4 text-[0.8125rem] text-[#6f7a8f] md:py-5 md:text-sm">No assets matched the current search.</p> : null}<div className="space-y-1 md:space-y-1.5">{assets.map((asset) => <button className="grid h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[0.625rem] border border-transparent bg-[#101418] px-3 py-2 text-left transition hover:border-[#232931] hover:bg-[#14191f] md:h-auto md:rounded-[0.9rem] md:py-3" key={`${asset.symbol}-${asset.assetType}`} onClick={() => onSelect(asset)} type="button"><div className="flex min-w-0 items-center gap-3"><AssetAvatar symbol={asset.symbol} logoUrl={asset.logoUrl} dark /><div className="min-w-0"><div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 md:gap-x-2.5"><span className="truncate text-[0.875rem] font-medium text-white md:text-[0.92rem]">{asset.name}</span><span className="text-[0.6875rem] text-[#7f8aa3] md:text-[0.8rem]">{asset.symbol}</span></div><p className="mt-0.5 truncate text-[0.6875rem] text-[#6f7a8f] md:text-[0.72rem]">{asset.name}</p></div></div><div className="flex items-center gap-2 text-[0.8125rem] text-[#6f7a8f] md:gap-2.5 md:text-sm"><span className="rounded-full border border-[#232931] bg-[#14191f] px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[#9daccc] md:px-2.5 md:py-1 md:text-[0.64rem] md:tracking-[0.16em]">{getFilterLabel(normalizeAssetType(asset.assetType) as SelectorFilter)}</span><span className="text-[1rem] leading-none text-[#7f8aa3] md:text-lg">&rsaquo;</span></div></button>)}</div></div></div>;
}

function SelectorHeader({ onBack, onClose, stepLabel, title }: { onBack?: () => void; onClose: () => void; stepLabel: string; title: string }) {
  return <header className="px-4 py-3 md:px-7 md:pb-5 md:pt-6"><div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">{onBack ? <button className="rounded-full p-1.5 text-[1.125rem] leading-none text-[#7f8aa3] transition hover:bg-[#171d27] hover:text-white md:p-2 md:text-[1.45rem]" onClick={onBack} type="button"><span aria-hidden="true">&lsaquo;</span></button> : <span className="h-8 w-8 md:h-9 md:w-9" aria-hidden="true" />}<div className="text-center"><h2 className="text-[1.125rem] font-semibold text-white md:text-[1.16rem] md:tracking-[-0.03em]">{title}</h2><p className="mt-0.5 text-[0.6875rem] text-[#6f7a8f] md:mt-1 md:text-sm">{stepLabel}</p></div><button className="rounded-full p-1.5 text-[1.125rem] leading-none text-[#7f8aa3] transition hover:bg-[#171d27] hover:text-white md:p-2 md:text-[1.7rem]" onClick={onClose} type="button"><span aria-hidden="true">&times;</span></button></div></header>;
}

function SimpleEditor({ children, cta, onBack, stepLabel, title }: { children: ReactNode; cta: string; onBack: () => void; stepLabel: string; title: string }) {
  return <div className="space-y-3 md:space-y-5"><header className="flex items-center gap-2.5 pr-8"><button className="rounded-full p-1.5 text-[1.125rem] leading-none text-[#7f8aa3] transition hover:bg-[#14191f] hover:text-white md:p-2 md:text-[1.7rem]" onClick={onBack} type="button"><span aria-hidden="true">&lsaquo;</span></button><div><h2 className="text-[1.125rem] font-semibold text-white md:text-[1.25rem] md:tracking-[-0.03em]">{title}</h2><p className="mt-0.5 text-[0.6875rem] text-[#6f7a8f] md:mt-1 md:text-sm">{stepLabel}</p></div></header>{children}<button className="w-full rounded-[0.82rem] bg-[#3f8c53] px-4 py-2.5 text-[0.875rem] font-semibold text-white transition hover:bg-[#4a9b5f] md:px-5 md:py-3 md:text-[0.92rem]" onClick={onBack} type="button">{cta}</button></div>;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="block rounded-[0.875rem] border border-[#232931] bg-[#14191f] px-3 py-2 md:rounded-[0.95rem] md:py-2.5 md:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"><span className="block text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.66rem]">{label}</span><div className="mt-1 md:mt-2">{children}</div></label>;
}


function createDefaultDateTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  const hours = `${now.getHours()}`.padStart(2, "0");
  const minutes = `${now.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return createDefaultDateTime();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDecimal(value: string) {
  const normalized = value.replace(/,/g, ".").trim();
  const parsed = Number(normalized || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatEditableNumber(value: number) {
  if (!Number.isFinite(value) || value === 0) return "0";
  return value.toString();
}


function filterAssetsByType(assets: AssetOption[], filter: string) {
  const normalizedFilter = normalizeAssetType(filter) ?? "ALL";
  if (normalizedFilter === "ALL") return assets;
  return assets.filter((asset) => normalizeAssetType(asset.assetType) === normalizedFilter);
}

function matchesAssetQuery(asset: AssetOption, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return asset.symbol.toLowerCase().includes(normalizedQuery) || asset.name.toLowerCase().includes(normalizedQuery);
}

function mergeAssetOptions(assets: AssetOption[]) {
  const map = new Map<string, AssetOption>();

  assets.forEach((asset) => {
    const normalizedType = normalizeAssetType(asset.assetType) ?? asset.assetType;
    const key = `${asset.symbol}-${normalizedType}`;
    const current = map.get(key);

    if (!current) {
      map.set(key, { ...asset, assetType: normalizedType });
      return;
    }

    map.set(key, {
      ...current,
      ...asset,
      assetType: normalizedType,
      logoUrl: asset.logoUrl ?? current.logoUrl,
      suggestedPrice: asset.suggestedPrice ?? current.suggestedPrice,
    });
  });

  return Array.from(map.values());
}

function getFilterLabel(filter?: string) {
  if (!filter) return "All";
  switch (normalizeAssetType(filter)) {
    case "CRYPTO": return "Crypto";
    case "STOCK": return "Stocks";
    case "ETF": return "ETFs";
    case "INDEX": return "Indices";
    default: return "All";
  }
}

function supportsDirectSymbolLookup(filter?: string) {
  if (!filter) return false;
  const normalized = normalizeAssetType(filter);
  return normalized === "STOCK" || normalized === "ETF";
}

function getPortfolioLabel(filter?: string) {
  if (!filter) return "Multi-asset";
  switch (normalizeAssetType(filter)) {
    case "CRYPTO": return "Crypto";
    case "STOCK": return "Stocks";
    case "ETF": return "ETFs";
    case "INDEX": return "Index";
    default: return "Multi-asset";
  }
}

function getAssetTypeCard(filter: SelectorFilter) {
  switch (filter) {
    case "CRYPTO":
      return {
        title: "Criptomonedas",
        description: "Tokens, DeFi, Stablecoins",
        badgeClassName: "bg-[#1b1511] text-[#f7931a]",
        icon: <CryptoAssetIcon className="h-5 w-5" />,
      };
    case "STOCK":
      return {
        title: "Acciones",
        description: "Mercado bursatil global",
        badgeClassName: "bg-[#101722] text-[#60a5fa]",
        icon: <StocksAssetIcon className="h-5 w-5" />,
      };
    case "ETF":
      return {
        title: "ETFs / Fondos",
        description: "Indices y fondos mutuos",
        badgeClassName: "bg-[#14132a] text-[#818cf8]",
        icon: <EtfAssetIcon className="h-5 w-5" />,
      };
    case "INDEX":
      return {
        title: "Indices",
        description: "Benchmarks y canastas de mercado",
        badgeClassName: "bg-[#0f1d1b] text-[#34d399]",
        icon: <IndexAssetIcon className="h-5 w-5" />,
      };
    default:
      return {
        title: "Activo",
        description: "Selecciona la clase de activo.",
        badgeClassName: "bg-[#14191f] text-white",
        icon: <IndexAssetIcon className="h-5 w-5" />,
      };
  }
}

function buildMergedSuggestions(suggestedAssets: AssetOption[], logoRegistry: AssetLogoRegistry) {
  const map = new Map<string, AssetOption>();
  [...suggestedAssets, ...POPULAR_ASSETS].forEach((asset) => {
    if (!asset?.symbol) return;
    const assetType = normalizeAssetType(asset.assetType) ?? asset.assetType;
    const logoUrl = asset.logoUrl ?? getAssetLogoFromRegistry(logoRegistry, asset.symbol, asset.assetType);
    map.set(`${asset.symbol}-${assetType}`, { ...asset, assetType, logoUrl });
  });
  return Array.from(map.values());
}

function CryptoAssetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.18" />
      <path d="M12.1 5.8v2.1M12.1 16.1v2.1M9.1 8.8h3.7a2 2 0 0 1 0 4H9.1h4.3a2 2 0 1 1 0 4H9.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function StocksAssetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M5 18.5h14M6.5 16V9.5M11.5 16V6.5M16.5 16v-4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M6 9l3-2.5 3.2 1.7 4-4.2 1.8 1.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function EtfAssetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <rect height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" width="11" x="6.5" y="5" />
      <path d="M9.5 9.5h5M9.5 13h5M9.5 16.5h3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M4.5 8.5h.01M4.5 12h.01M4.5 15.5h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.3" />
    </svg>
  );
}

function IndexAssetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.2v9.6M7.2 12h9.6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}
