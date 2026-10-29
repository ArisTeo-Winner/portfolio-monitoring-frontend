"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { CryptoSelector } from "@/components/transactions/cryptoSelector";
import { GbmUploadSection } from "@/components/import/gbm-upload-section";
import { invalidatePortfolioCache } from "@/features/portfolio/api/get-portfolio";
import { Modal } from "@/components/ui/modal";
import { ProblemAlert } from "@/components/ui/problem-alert";
import type { AssetOption } from "@/features/assets/types/asset.types";
import { getAssetLogoFromRegistry, readAssetLogoRegistry, rememberAssetLogo, type AssetLogoRegistry } from "@/features/assets/lib/asset-logo-registry";
import { searchAssets } from "@/features/assets/api/search-assets";
import { resolveMarketSymbolCandidate } from "@/features/assets/api/resolve-market-symbol";
import { getPopularAssets, type PopularAssets } from "@/features/assets/api/get-popular-assets";
import { getRecentAssets, rememberRecentAsset } from "@/features/assets/lib/recent-assets";
import { getAssetPrice } from "@/features/marketdata/api/get-asset-price";
import { getBanxicoCetesCurveCached, type BanxicoCetesCurve } from "@/features/marketdata/api/get-banxico-cetes-curve";
import { createBuyTransaction, createSellTransaction, createTransferTransaction, registerDividend, updateTransaction, toOffsetDateTime } from "@/features/transactions/api/create-transaction";
import { useSplitPreview } from "@/features/portfolio/hooks/use-split-preview";
import { SplitPreviewNotice } from "@/components/transactions/split-adjustment-card";
import type { DividendType, TransactionMode, TransferDirection } from "@/features/transactions/types/transaction.types";
import { buildFeePayload, calculateBuyTotal, calculateSellTotal, resolveEffectiveFee } from "@/features/transactions/utils/totals";
import { formatFeeCurrency } from "@/lib/utils/format";
import { getAssetCurrency, formatCurrencyByCode, type CurrencyCode } from "@/lib/utils/currency";
import { normalizeAssetType, supportsDividend } from "@/lib/utils/asset";
import { ApiError } from "@/lib/api/problem-details";
import { AssetAvatar } from "@/components/shared/AssetAvatar";
import { DateTimePicker } from "@/components/ui/date-time-picker";

// Standard nominal value per CETES titulo (Banxico / cetesdirecto).
const CETES_FACE_VALUE_PER_TITLE = 10;

const EMPTY_SUGGESTED_ASSETS: AssetOption[] = [];
const EMPTY_POPULAR_ASSETS: PopularAssets = { stocks: [], etfs: [], cryptos: [], governmentBonds: [] };

const SELECTOR_FILTERS = ["ALL", "CRYPTO", "STOCK", "ETF", "GOVERNMENT_BOND", "INDEX"] as const;
type SelectorFilter = (typeof SELECTOR_FILTERS)[number];
// ADR-0012 F2 / "Origen de Datos" wizard: the guided entry (global "+ Activo")
// now starts at `origin` (choose the loading philosophy) before the manual
// category flow. `providers` + `gbm` are the automatic-sync branch.
type ModalView = "origin" | "providers" | "gbm" | "type" | "form" | "asset" | "fee" | "notes";
type DataOrigin = "auto" | "manual";

// Automatic-sync providers shown in the `providers` step. Only GBM is live
// today; the rest render disabled with a "Próximamente" badge (same policy as
// the create-portfolio method grid).
const DATA_PROVIDERS = [
  { id: "gbm", title: "Importar desde GBM", description: "Estado de cuenta / confirmaciones DriveWealth en PDF", channel: "PDF", available: true },
  { id: "binance", title: "Connect Binance Account", description: "Sincroniza tus activos sin usar API key", channel: "API", available: false },
  { id: "ibkr", title: "Interactive Brokers", description: "Importa posiciones y operaciones (Flex Query)", channel: "API", available: false },
  { id: "okx", title: "Connect OKX Account", description: "Sincroniza tus activos sin usar API key", channel: "API", available: false },
  { id: "wallet", title: "Connect Your Wallet", description: "Pega tu dirección pública (no se firma nada)", channel: "WEB3", available: false },
] as const;

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
  const [logoRegistry, setLogoRegistry] = useState<AssetLogoRegistry>({});
  const [popularAssets, setPopularAssets] = useState<PopularAssets>(EMPTY_POPULAR_ASSETS);
  const [recentAssets, setRecentAssets] = useState<AssetOption[]>([]);
  const flatPopularAssets = useMemo(
    () => [...popularAssets.stocks, ...popularAssets.etfs, ...popularAssets.cryptos, ...popularAssets.governmentBonds],
    [popularAssets],
  );
  const mergedSuggestions = useMemo(() => {
    return buildMergedSuggestions([...suggestedAssets, ...flatPopularAssets], logoRegistry);
  }, [logoRegistry, suggestedAssets, flatPopularAssets]);

  const [view, setView] = useState<ModalView>(shouldSelectAssetTypeFirst ? "origin" : initialAsset || initialDraft ? "form" : "asset");
  // Which "loading philosophy" the user picked in the origin step (null until chosen).
  const [dataOrigin, setDataOrigin] = useState<DataOrigin | null>(null);
  const [mode, setMode] = useState<TransactionMode>("BUY");
  const [transferType, setTransferType] = useState<TransferDirection>("TRANSFER_IN");
  const [selectedFilter, setSelectedFilter] = useState<SelectorFilter>(initialFilter);
  const [selectedAsset, setSelectedAsset] = useState<AssetOption | null>(initialAsset);
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  // Settlement currency the user picks (USD/MXN). Null = derive from the symbol
  // default; a non-null value is an explicit override sent to the backend so a
  // BMV/GBM peso trade (e.g. "MELI N") is stored as MXN instead of null→USD.
  const [currencyOverride, setCurrencyOverride] = useState<CurrencyCode | null>(null);
  const [fee, setFee] = useState("");
  // Manual commission/IVA split (BUY/SELL only). When either is set the submit
  // sends brokerCommission/brokerIva instead of the single `fee`.
  const [brokerCommission, setBrokerCommission] = useState("");
  const [brokerIva, setBrokerIva] = useState("");
  // Once the user edits IVA by hand, stop auto-deriving it from the commission.
  const [ivaTouched, setIvaTouched] = useState(false);
  const [notes, setNotes] = useState("");
  const [broker, setBroker] = useState("");
  const [transactionDate, setTransactionDate] = useState(createDefaultDateTime());
  // Dividend-only fields
  const [dividendAmount, setDividendAmount] = useState("");
  const [dividendType, setDividendType] = useState<DividendType>("CASH");
  const [exDividendDate, setExDividendDate] = useState("");
  const [taxWithheld, setTaxWithheld] = useState("");
  // GOVERNMENT_BOND BUY-only fields — the user invests a peso amount
  // (matching cetesdirecto's own calculator) and titulos/price/faceValue are
  // all derived from it below, not typed directly.
  const [investAmount, setInvestAmount] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [couponRate, setCouponRate] = useState("0");
  const [autoReinvestment, setAutoReinvestment] = useState(false);
  const [bondCurve, setBondCurve] = useState<BanxicoCetesCurve | null>(null);
  const [selectorQuery, setSelectorQuery] = useState("");
  const [selectorResults, setSelectorResults] = useState<AssetOption[]>([]);
  const [selectorLoading, setSelectorLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A single idempotency key is minted per submit attempt and reused across
  // retries of the SAME form (only regenerated when the form is reset for a
  // genuinely new transaction), so a retried submit after a failed request
  // doesn't defeat the backend's idempotency protection.
  const idempotencyKeyRef = useRef<string>(createIdempotencyKey());
  const queryClient = useQueryClient();

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
    setRecentAssets(getRecentAssets());
    let active = true;
    getPopularAssets()
      .then((data) => {
        if (active) setPopularAssets(data);
      })
      .catch(() => {
        // Popular assets are a convenience list — failures fall back silently
        // to whatever suggestedAssets/search already provides.
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const registry = readAssetLogoRegistry();
    const nextFilter = (lockedAssetType ?? "ALL") as SelectorFilter;
    const nextSuggestions = buildMergedSuggestions([...suggestedAssets, ...flatPopularAssets], registry);
    const hydratedInitialAsset = initialAsset
      ? {
          ...initialAsset,
          logoUrl: initialAsset.logoUrl ?? getAssetLogoFromRegistry(registry, initialAsset.symbol, initialAsset.assetType),
        }
      : null;
    const defaultAsset = hydratedInitialAsset ?? filterAssetsByType(nextSuggestions, nextFilter)[0] ?? null;
    idempotencyKeyRef.current = createIdempotencyKey();
    setView(shouldSelectAssetTypeFirst ? "origin" : initialAsset || initialDraft ? "form" : "asset");
    setDataOrigin(null);
    setMode(initialDraft?.mode ?? "BUY");
    setTransferType(initialDraft?.transferType ?? "TRANSFER_IN");
    setSelectedFilter(nextFilter);
    setSelectedAsset(shouldSelectAssetTypeFirst ? null : defaultAsset);
    setQuantity(initialDraft?.quantity !== undefined ? formatEditableNumber(initialDraft.quantity) : "");
    setPricePerUnit(initialDraft?.pricePerUnit !== undefined ? formatEditableNumber(initialDraft.pricePerUnit) : !shouldSelectAssetTypeFirst && defaultAsset?.suggestedPrice ? formatEditableNumber(defaultAsset.suggestedPrice) : "");
    setFee(initialDraft?.fee !== undefined && initialDraft.fee > 0 ? formatEditableNumber(initialDraft.fee) : "");
    // A pre-filled draft fee seeds the commission field (split mode hides the
    // single-fee input); IVA starts empty and auto-derives from the commission.
    setBrokerCommission(initialDraft?.fee !== undefined && initialDraft.fee > 0 ? formatEditableNumber(initialDraft.fee) : "");
    setBrokerIva("");
    setIvaTouched(false);
    setCurrencyOverride(null);
    setNotes(initialDraft?.notes ?? "");
    setBroker("");
    setDividendAmount("");
    setDividendType("CASH");
    setExDividendDate("");
    setTaxWithheld("");
    setInvestAmount("");
    setMaturityDate("");
    setCouponRate("0");
    setAutoReinvestment(false);
    setTransactionDate(initialDraft?.transactionDate ? toLocalDateTimeInput(initialDraft.transactionDate) : createDefaultDateTime());
    setSelectorQuery("");
    setSelectorResults(filterAssetsByType(nextSuggestions, nextFilter));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- flatPopularAssets intentionally excluded: it loads async and must not re-trigger a full form reset.
  }, [initialAsset, initialDraft, isOpen, lockedAssetType, shouldSelectAssetTypeFirst, suggestedAssets]);

  useEffect(() => {
    // Government bonds (CETES, UDIBONO, etc.) have no live market quote —
    // their purchase price is a discount rate the user enters manually, not
    // something getAssetPrice can fetch.
    const skipAutoPrice = mode === "TRANSFER" || mode === "DIVIDEND" || (selectedAsset ? normalizeAssetType(selectedAsset.assetType) === "GOVERNMENT_BOND" : false);
    if (!isOpen || !selectedAsset || skipAutoPrice) {
      if (mode === "TRANSFER" || mode === "DIVIDEND") setPricePerUnit("");
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
    if (!isOpen || mode !== "BUY" || normalizeAssetType(selectedAsset?.assetType ?? "") !== "GOVERNMENT_BOND") return;
    let active = true;
    getBanxicoCetesCurveCached()
      .then((curve) => {
        if (active) setBondCurve(curve);
      })
      .catch(() => {
        // Curve fetch failure just means no auto-suggested price — the user
        // can still enter faceValue/price manually, so this fails silently.
      });
    return () => {
      active = false;
    };
  }, [isOpen, mode, selectedAsset]);

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

  const assetFieldType = (selectedAsset?.assetType ? normalizeAssetType(selectedAsset.assetType) : undefined) ?? lockedAssetType ?? selectedFilter;
  const isBondBuy = mode === "BUY" && assetFieldType === "GOVERNMENT_BOND";

  // CETES (zero-coupon) discount pricing: price per titulo = 10 / (1 + tasa/100 * dias/360).
  // Rounded to 2 decimals to match how CETES prices are always quoted (cetesdirecto, brokers) —
  // the raw division otherwise carries 12+ meaningless floating-point digits.
  const bondTermDays = isBondBuy && selectedAsset ? parseCetesTermDays(selectedAsset.symbol) : null;
  const bondRate = bondTermDays !== null && bondCurve ? bondCurve[bondTermDays] : undefined;
  const bondUnitPrice =
    bondTermDays !== null && bondRate !== undefined
      ? Math.round((CETES_FACE_VALUE_PER_TITLE / (1 + (bondRate / 100) * (bondTermDays / 360))) * 100) / 100
      : null;
  const investAmountValue = parseDecimal(investAmount);
  // Titulos are only sold whole — leftover cash below one titulo's price stays uninvested,
  // same as cetesdirecto's own calculator (shown there as "Remanente").
  const bondTitulos = isBondBuy && bondUnitPrice && bondUnitPrice > 0 ? Math.floor(investAmountValue / bondUnitPrice) : 0;

  const quantityValue = isBondBuy ? bondTitulos : parseDecimal(quantity);
  const priceValue = isBondBuy ? (bondUnitPrice ?? 0) : parseDecimal(pricePerUnit);
  const feeValue = parseDecimal(fee);
  const commissionValue = parseDecimal(brokerCommission);
  const ivaValue = parseDecimal(brokerIva);
  // Commission/IVA split applies only to manual BUY/SELL of non-bond assets.
  // Bonds (cetesdirecto), transfers, dividends and edits keep the single fee.
  const usesSplit = !isEditing && (mode === "BUY" || mode === "SELL") && assetFieldType !== "GOVERNMENT_BOND";
  const effectiveFeeValue = resolveEffectiveFee(usesSplit, commissionValue, ivaValue, feeValue);
  const dividendAmountValue = parseDecimal(dividendAmount);
  const taxWithheldValue = parseDecimal(taxWithheld);
  const faceValueValue = isBondBuy ? bondTitulos * CETES_FACE_VALUE_PER_TITLE : 0;
  const couponRateValue = parseDecimal(couponRate);
  const totalValue = mode === "SELL" ? calculateSellTotal(quantityValue, priceValue, effectiveFeeValue) : calculateBuyTotal(quantityValue, priceValue, effectiveFeeValue);
  const totalLabel = mode === "SELL" ? "Total Received" : mode === "TRANSFER" ? "Transfer Quantity" : "Total Spent";
  const submitLabel = isEditing ? "Edit Transaction" : mode === "BUY" ? "Add Transaction" : mode === "SELL" ? "Record Sale" : mode === "DIVIDEND" ? "Register Dividend" : "Record Transfer";
  const selectorFilters = lockedAssetType
    ? [lockedAssetType as SelectorFilter]
    : availableFilterTypes.includes(selectedFilter)
      ? availableFilterTypes
      : [selectedFilter, ...availableFilterTypes.filter((filter) => filter !== selectedFilter)];
  const typeSelectionFilters = lockedAssetType ? [lockedAssetType as SelectorFilter] : SELECTOR_FILTERS.filter((filter) => filter !== "ALL");
  const portfolioLabel = portfolioName ?? getPortfolioLabel(((initialAsset?.assetType ? normalizeAssetType(initialAsset.assetType) : undefined) as SelectorFilter | undefined) ?? (lockedAssetType as SelectorFilter | undefined) ?? selectedAsset?.assetType ?? selectedFilter);
  const activeSelectorFilter = (lockedAssetType as SelectorFilter | undefined) ?? selectedFilter;
  // Default currency: CETES/bonds settle in MXN; everything else follows the
  // symbol convention (trailing "*" = MXN, else USD). The user can override it
  // via the currency selector below (shown for stocks/ETFs), which is what lets
  // a GBM/BMV peso trade be registered as MXN.
  const defaultCurrency: CurrencyCode =
    assetFieldType === "GOVERNMENT_BOND" ? "MXN" : getAssetCurrency(selectedAsset?.symbol ?? "");
  const currency = currencyOverride ?? defaultCurrency;
  const showCurrencyToggle = (mode === "BUY" || mode === "SELL" || mode === "DIVIDEND") && (assetFieldType === "STOCK" || assetFieldType === "ETF");

  // ADR-0011 split heads-up: for stock/ETF buys & sells, check whether a split
  // sits between the chosen trade date and today. Informational only — the submit
  // still sends the RAW captured values; the backend adjusts on read. Debounced
  // so it fires on settle, not on every keystroke (endpoint has no rate limit).
  const splitEligible =
    !isEditing &&
    (assetFieldType === "STOCK" || assetFieldType === "ETF") &&
    (mode === "BUY" || mode === "SELL") &&
    quantityValue > 0 &&
    priceValue > 0;
  const splitPreviewDate = useMemo(() => {
    if (!transactionDate) return null;
    const parsed = new Date(transactionDate);
    return Number.isNaN(parsed.getTime()) ? null : toOffsetDateTime(transactionDate);
  }, [transactionDate]);
  const { data: splitPreview } = useSplitPreview({
    symbol: selectedAsset?.symbol,
    transactionDate: splitPreviewDate,
    quantity: quantityValue,
    pricePerUnit: priceValue,
    enabled: splitEligible,
    debounceMs: 500,
  });

  useEffect(() => {
    if (!isOpen || !isBondBuy || maturityDate) return;
    const days = selectedAsset ? parseCetesTermDays(selectedAsset.symbol) : null;
    if (!days) return;
    const target = new Date();
    target.setDate(target.getDate() + days);
    setMaturityDate(toDateInputValue(target));
  }, [isOpen, isBondBuy, maturityDate, selectedAsset]);

  // Auto-derive IVA as 16% of the commission for MXN assets (0 for USD), until
  // the user edits IVA by hand. The 16% lives entirely in the UI — the backend
  // receives IVA as an absolute amount and never recomputes it (ADR-0005).
  useEffect(() => {
    if (!isOpen || !usesSplit || ivaTouched) return;
    const commission = parseDecimal(brokerCommission);
    const rate = currency === "MXN" ? 0.16 : 0;
    const iva = commission > 0 ? Math.round(commission * rate * 100) / 100 : 0;
    const next = iva > 0 ? formatEditableNumber(iva) : "";
    setBrokerIva((prev) => (prev === next ? prev : next));
  }, [isOpen, usesSplit, ivaTouched, brokerCommission, currency]);

  const dividendAllowed = selectedAsset ? supportsDividend(selectedAsset.assetType) : false;
  const estimatedBondGain = faceValueValue - totalValue;
  const brokerPlaceholder = currency === "MXN" ? "GBM / Bursanet / cetesdirecto" : "GBM / IBKR";
  const formTitle = isEditing ? "Edit Transaction" : "Add Transaction";
  const formDescription = isEditing
    ? "Actualiza los datos de la operación."
    : `${stepLabelFor("form")}. Completa los datos de la operación.`;

  const submitDisabled =
    submitting ||
    !selectedAsset ||
    !transactionDate ||
    (mode === "DIVIDEND"
      ? dividendAmountValue <= 0
      : quantityValue <= 0 ||
        (mode !== "TRANSFER" && (priceLoading || priceValue <= 0)) ||
        (isBondBuy && (faceValueValue <= 0 || !maturityDate)));

  if (!isOpen) return null;

  async function handleSubmit() {
    if (!selectedAsset) return setError("Selecciona un activo antes de registrar la transacción.");
    if (mode === "DIVIDEND") {
      if (dividendAmountValue <= 0) return setError("El monto del dividendo debe ser mayor que cero.");
    } else {
      if (isBondBuy && investAmountValue > 0 && quantityValue <= 0) return setError("El monto ingresado no alcanza para comprar un título completo.");
      if (quantityValue <= 0) return setError("La cantidad debe ser mayor que cero.");
      if (mode !== "TRANSFER" && priceValue <= 0) return setError("No hay precio válido para completar la transacción.");
      if (isBondBuy && faceValueValue <= 0) return setError("El valor nominal (faceValue) del bono es requerido.");
      if (isBondBuy && !maturityDate) return setError("La fecha de vencimiento del bono es requerida.");
    }
    setSubmitting(true);
    setError(null);
    const idempotencyKey = idempotencyKeyRef.current;
    try {
      rememberAssetLogo(selectedAsset);
      rememberRecentAsset(selectedAsset);
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
          // Only send currency on edit when the user explicitly changed it, so an
          // edit doesn't overwrite the stored currency with a symbol-derived guess
          // (the edit form does not seed the original currency).
          currency: currencyOverride ?? undefined,
        });
      } else if (mode === "DIVIDEND") {
        await registerDividend(
          {
            assetSymbol: selectedAsset.symbol,
            assetType: selectedAsset.assetType,
            amount: dividendAmountValue,
            dividendType,
            currency,
            transactionDate,
            exDividendDate: exDividendDate || undefined,
            taxWithheld: taxWithheldValue > 0 ? taxWithheldValue : undefined,
            broker: broker.trim() || undefined,
          },
          idempotencyKey,
        );
      } else if (mode === "BUY") {
        await createBuyTransaction(
          {
            assetSymbol: selectedAsset.symbol,
            assetType: selectedAsset.assetType,
            quantity: quantityValue,
            pricePerUnit: priceValue,
            // Split path: send commission/IVA and let the backend derive `fee`.
            // Classic path: send the single `fee`. Never both (ADR-0005).
            ...buildFeePayload(usesSplit, commissionValue, ivaValue, feeValue),
            currency,
            transactionDate,
            notes: notes.trim() || undefined,
            broker: broker.trim() || undefined,
            ...(isBondBuy
              ? {
                  faceValue: faceValueValue,
                  maturityDate,
                  couponRate: couponRateValue,
                  autoReinvestment,
                }
              : {}),
          },
          idempotencyKey,
        );
      } else if (mode === "SELL") {
        await createSellTransaction(
          {
            assetSymbol: selectedAsset.symbol,
            assetType: selectedAsset.assetType,
            quantity: quantityValue,
            pricePerUnit: priceValue,
            ...buildFeePayload(usesSplit, commissionValue, ivaValue, feeValue),
            currency,
            transactionDate,
            notes: notes.trim() || undefined,
            broker: broker.trim() || undefined,
          },
          idempotencyKey,
        );
      } else {
        await createTransferTransaction(
          {
            assetSymbol: selectedAsset.symbol,
            assetType: selectedAsset.assetType,
            transferType,
            quantity: quantityValue,
            fee: feeValue || undefined,
            currency,
            transactionDate,
            notes: notes.trim() || undefined,
          },
          idempotencyKey,
        );
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("portfolio:refresh"));
      }
      await onCreated?.();
      onClose();
    } catch (submitError) {
      if (submitError instanceof ApiError && submitError.status === 409) {
        setError("Ya se registró esta operación (conflicto de idempotencia). Revisa el historial antes de reintentar.");
      } else {
        setError(submitError instanceof Error ? submitError.message : isEditing ? "No fue posible actualizar la transacción." : "No fue posible registrar la transacción.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleAssetSelect(asset: AssetOption) {
    if (!asset.supportedForTransactions) return;
    rememberAssetLogo(asset);
    rememberRecentAsset(asset);
    setLogoRegistry(readAssetLogoRegistry());
    setRecentAssets(getRecentAssets());
    setSelectedAsset(asset);
    setCurrencyOverride(null);
    setPricePerUnit(asset.suggestedPrice ? formatEditableNumber(asset.suggestedPrice) : "");
    setInvestAmount("");
    setMaturityDate("");
    if (mode === "DIVIDEND" && !supportsDividend(asset.assetType)) setMode("BUY");
    setSelectorQuery("");
    setSelectorResults(filterAssetsByType(mergedSuggestions, lockedAssetType ?? selectedFilter));
    setView("form");
  }

  function handleAssetTypeSelect(filter: SelectorFilter) {
    setSelectedFilter(filter);
    setSelectorQuery("");
    setSelectorResults(filterAssetsByType(mergedSuggestions, filter));
    setSelectedAsset(null);
    setCurrencyOverride(null);
    setPricePerUnit("");
    setError(null);
    setView("asset");
  }

  function handleOriginSelect(origin: DataOrigin) {
    setDataOrigin(origin);
    setError(null);
    setView(origin === "auto" ? "providers" : "type");
  }

  function handleProviderSelect(providerId: string) {
    // Only GBM is wired today; the rest are informational ("Próximamente").
    if (providerId !== "gbm") return;
    setError(null);
    setView("gbm");
  }

  async function refreshAfterImport() {
    invalidatePortfolioCache();
    await queryClient.invalidateQueries({ queryKey: ["portfolio-holdings-performance"] });
    await queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
    if (typeof window !== "undefined") window.dispatchEvent(new Event("portfolio:refresh"));
    await onCreated?.();
  }

  // Step counter for the guided entry. The manual branch keeps the real
  // category→asset→form sub-steps (4 total); the automatic branch is
  // origin→provider→import (3 total). Non-guided entries keep the legacy "de 2".
  function stepLabelFor(target: ModalView): string {
    if (!shouldSelectAssetTypeFirst) return target === "asset" ? "Paso 1 de 2" : "Paso 2 de 2";
    if (target === "origin") return "Paso 1";
    if (dataOrigin === "auto") {
      const n = target === "providers" ? 2 : 3; // gbm
      return `Paso ${n} de 3`;
    }
    const n = target === "type" ? 2 : target === "asset" ? 3 : 4; // form / fee / notes = 4
    return `Paso ${n} de 4`;
  }

  // Selector-style steps share the wide, padding-less panel and render their own close button.
  const isSelectorView = view === "origin" || view === "providers" || view === "gbm" || view === "type" || view === "asset";

  return (
    <Modal onClose={isSelectorView ? undefined : onClose} overlayClassName="bg-[#04070d]/84 backdrop-blur-[8px]" panelClassName={isSelectorView ? "max-h-[90vh] max-w-[608px] overflow-hidden rounded-[0.9rem] border border-[#1e232b] bg-[radial-gradient(circle_at_top,rgba(20,23,28,0.98),rgba(10,12,16,0.99)_72%)] px-0 py-0 text-white shadow-[0_28px_72px_rgba(0,0,0,0.5)] ring-0 md:rounded-[1.15rem] md:shadow-[0_40px_120px_rgba(0,0,0,0.62)]" : `max-h-[90vh] max-w-[430px] ${view === "form" && isBondBuy ? "md:max-w-[760px]" : ""} hide-scrollbar overflow-y-auto rounded-[0.9rem] border border-[#1e232b] bg-[radial-gradient(circle_at_top,rgba(20,23,28,0.98),rgba(10,12,16,0.99)_72%)] px-3 py-3 text-white shadow-[0_24px_72px_rgba(0,0,0,0.48)] ring-0 md:rounded-[1.05rem] md:shadow-[0_32px_96px_rgba(0,0,0,0.54)]`}>
      {view === "origin" ? <OriginSelectionView trigger={isEditing ? "transaction" : "activo"} onClose={onClose} onSelect={handleOriginSelect} stepLabel={stepLabelFor("origin")} /> : null}
      {view === "providers" ? <ProviderSelectionView onBack={() => setView("origin")} onClose={onClose} onSelect={handleProviderSelect} stepLabel={stepLabelFor("providers")} /> : null}
      {view === "gbm" ? (
        <div className="flex max-h-[90vh] flex-col md:max-h-[82vh]">
          <SelectorHeader onBack={() => setView("providers")} onClose={onClose} stepLabel={stepLabelFor("gbm")} title="Importar desde GBM" />
          <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-5 md:px-7 md:pb-7">
            <GbmUploadSection onImported={refreshAfterImport} />
          </div>
        </div>
      ) : null}
      {view === "type" ? <AssetTypeSelectionView filters={typeSelectionFilters} onBack={shouldSelectAssetTypeFirst ? () => setView("origin") : undefined} onClose={onClose} onSelect={handleAssetTypeSelect} stepLabel={stepLabelFor("type")} /> : null}
      {view === "asset" ? (
        <AssetSelectorView
          activeFilter={activeSelectorFilter}
          assets={selectorResults}
          filters={selectorFilters}
          loading={selectorLoading}
          lockedAssetType={lockedAssetType}
          onBack={selectedAsset ? () => setView("form") : shouldSelectAssetTypeFirst ? () => setView("type") : undefined}
          onClose={onClose}
          onFilterChange={setSelectedFilter}
          onQueryChange={setSelectorQuery}
          onSelect={handleAssetSelect}
          popularAssets={popularAssets}
          portfolioLabel={portfolioLabel}
          query={selectorQuery}
          recentAssets={recentAssets}
          showFilterTabs={!shouldSelectAssetTypeFirst && !lockedAssetType}
          stepLabel={stepLabelFor("asset")}
        />
      ) : null}
      {view === "fee" ? (
        usesSplit ? (
          <SimpleEditor title="Comisión e IVA" cta="Aplicar costos" onBack={() => setView("form")} stepLabel={stepLabelFor("fee")}>
            <div className="space-y-2">
              <Field label="Comisión del broker">
                <div className="flex items-center gap-2.5"><span className="text-[0.875rem] font-semibold text-[#7f8aa3] md:text-[1rem]">$</span><input className="w-full bg-transparent text-[0.875rem] font-semibold text-white outline-none placeholder:text-[#6f7a8f] md:text-[1.15rem] md:tracking-[-0.03em]" inputMode="decimal" onChange={(event) => setBrokerCommission(event.target.value)} placeholder="0.00" step="any" type="number" value={brokerCommission} /></div>
              </Field>
              <Field label={currency === "MXN" ? "IVA (16% auto · editable)" : "IVA"}>
                <div className="flex items-center gap-2.5"><span className="text-[0.875rem] font-semibold text-[#7f8aa3] md:text-[1rem]">$</span><input className="w-full bg-transparent text-[0.875rem] font-semibold text-white outline-none placeholder:text-[#6f7a8f] md:text-[1.15rem] md:tracking-[-0.03em]" inputMode="decimal" onChange={(event) => { setIvaTouched(true); setBrokerIva(event.target.value); }} placeholder="0.00" step="any" type="number" value={brokerIva} /></div>
              </Field>
              <p className="px-1 text-[0.72rem] font-medium text-[#7f8aa3]">Total costos: <span className="font-semibold text-white">{formatFeeCurrency(commissionValue + ivaValue, currency)}</span></p>
            </div>
          </SimpleEditor>
        ) : (
          <SimpleEditor title="Add Fee" cta="Apply Fee" onBack={() => setView("form")} stepLabel={stepLabelFor("fee")}><Field label="Fee"><div className="flex items-center gap-2.5"><span className="text-[0.875rem] font-semibold text-[#7f8aa3] md:text-[1rem]">$</span><input className="w-full bg-transparent text-[0.875rem] font-semibold text-white outline-none placeholder:text-[#6f7a8f] md:text-[1.35rem] md:tracking-[-0.03em]" inputMode="decimal" onChange={(event) => setFee(event.target.value)} placeholder="0.00" step="any" type="number" value={fee} /></div></Field></SimpleEditor>
        )
      ) : null}
      {view === "notes" ? <SimpleEditor title="Add Notes" cta="Save Notes" onBack={() => setView("form")} stepLabel={stepLabelFor("fee")}><Field label="Notes"><textarea className="min-h-24 w-full resize-none bg-transparent text-[0.875rem] leading-5 text-white outline-none placeholder:text-[#6f7a8f] md:min-h-32 md:text-[0.95rem] md:leading-7" maxLength={255} onChange={(event) => setNotes(event.target.value)} placeholder="Exchange, source wallet, memo, reasoning..." value={notes} /></Field></SimpleEditor> : null}
      {view === "form" ? (
        <div className="space-y-2">
          <header className="pr-8 md:space-y-0.5 md:border-b md:border-[#1b2028] md:pb-2">
            <p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.68rem] md:tracking-[0.18em]">{portfolioLabel} portfolio</p>
            <h2 className="text-[1.125rem] font-semibold text-white md:text-[1.38rem] md:tracking-[-0.03em]">{formTitle}</h2>
            <p className="hidden text-sm text-[#7f8aa3] md:block">{formDescription}</p>
          </header>
          {isEditing ? null : <StepRail stepLabel={stepLabelFor("form")} />}

          {!isEditing ? (
            <div className="rounded-xl border border-[#1b2028] bg-[#101418] p-1 md:rounded-[0.9rem]">
              <div className={dividendAllowed ? "grid grid-cols-4 gap-1" : "grid grid-cols-3 gap-1"}>
                {(dividendAllowed ? (["BUY", "SELL", "TRANSFER", "DIVIDEND"] as TransactionMode[]) : (["BUY", "SELL", "TRANSFER"] as TransactionMode[])).map((tab) => {
                  const active = mode === tab;
                  return (
                    <button
                      className={active ? "h-7 rounded-xl border border-[#2a313b] bg-[#1a2028] px-2 text-[0.78125rem] font-semibold text-white md:h-auto md:rounded-[0.72rem] md:px-2 md:py-2 md:text-[0.78rem]" : "h-7 rounded-xl px-2 text-[0.78125rem] font-semibold text-[#6f7a8f] transition hover:bg-[#151a21] hover:text-white md:h-auto md:rounded-[0.72rem] md:px-2 md:py-2 md:text-[0.78rem]"}
                      key={tab}
                      onClick={() => setMode(tab)}
                      type="button"
                    >
                      {tab === "BUY" ? "Buy" : tab === "SELL" ? "Sell" : tab === "TRANSFER" ? "Transfer" : "Dividend"}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {mode === "TRANSFER" ? (
            <div className="rounded-xl border border-[#1b2028] bg-[#101418] p-1 md:rounded-[0.95rem]">
              <div className="grid grid-cols-2 gap-1 md:gap-2">
                {(["TRANSFER_IN", "TRANSFER_OUT"] as TransferDirection[]).map((option) => {
                  const active = transferType === option;
                  return (
                    <button className={active ? "h-7 rounded-xl border border-[#2a313b] bg-[#1a2028] px-3 text-[0.8125rem] font-semibold text-white md:h-auto md:rounded-[0.85rem] md:px-4 md:py-2.5 md:text-sm" : "h-7 rounded-xl px-3 text-[0.8125rem] font-semibold text-[#6f7a8f] transition hover:bg-[#151a21] hover:text-white md:h-auto md:rounded-[0.85rem] md:px-4 md:py-2.5 md:text-sm"} key={option} onClick={() => setTransferType(option)} type="button">
                      {option === "TRANSFER_IN" ? "Transfer In" : "Transfer Out"}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {mode === "DIVIDEND" ? (
            <div className="rounded-xl border border-[#1b2028] bg-[#101418] p-1 md:rounded-[0.95rem]">
              <div className="grid grid-cols-2 gap-1 md:gap-2">
                {(["CASH", "STOCK"] as DividendType[]).map((option) => {
                  const active = dividendType === option;
                  return (
                    <button className={active ? "h-7 rounded-xl border border-[#2a313b] bg-[#1a2028] px-3 text-[0.8125rem] font-semibold text-white md:h-auto md:rounded-[0.85rem] md:px-4 md:py-2.5 md:text-sm" : "h-7 rounded-xl px-3 text-[0.8125rem] font-semibold text-[#6f7a8f] transition hover:bg-[#151a21] hover:text-white md:h-auto md:rounded-[0.85rem] md:px-4 md:py-2.5 md:text-sm"} key={option} onClick={() => setDividendType(option)} type="button">
                      {option === "CASH" ? "Cash" : "Stock (DRIP)"}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {(() => {
            const assetRow = (
              <button className={`flex min-h-11 w-full items-center justify-between rounded-[0.875rem] border border-[#232931] bg-[#14191f] px-3 py-2 text-left md:rounded-[0.95rem] ${isEditing ? "cursor-default" : "transition hover:border-[#2f3742] hover:bg-[#181d24]"}`} disabled={isEditing} onClick={() => !isEditing && setView("asset")} type="button">
                <div className="flex items-center gap-3">
                  <AssetAvatar assetType={selectedAsset?.assetType} symbol={selectedAsset?.symbol ?? "?"} logoUrl={selectedAsset?.logoUrl ?? null} />
                  <div>
                    <p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.72rem]">Asset</p>
                    <div className="mt-0.5 flex items-baseline gap-2 md:mt-1">
                      <span className="text-[0.875rem] font-medium text-white md:text-[0.95rem]">{selectedAsset?.name ?? "Select Asset"}</span>
                      <span className="text-[0.75rem] text-[#7f8aa3] md:text-[0.76rem]">{selectedAsset?.symbol ?? getFilterLabel(lockedAssetType ?? selectedFilter)}</span>
                    </div>
                  </div>
                </div>
                {!isEditing ? <span className="text-[1rem] leading-none text-[#7f8aa3] md:text-[1.1rem]">&rsaquo;</span> : null}
              </button>
            );

            const currencyToggle = showCurrencyToggle ? (
              <div className="rounded-[0.875rem] border border-[#232931] bg-[#14191f] px-3 py-2 md:rounded-[0.95rem]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.68rem]">Moneda / Mercado</p>
                    <p className="mt-0.5 text-[0.7rem] text-[#7f8aa3]">Moneda en que se ejecutó (GBM MX = MXN)</p>
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-0.5 rounded-[0.7rem] border border-[#1b2028] bg-[#101418] p-0.5">
                    {(["USD", "MXN"] as CurrencyCode[]).map((code) => {
                      const active = currency === code;
                      return (
                        <button
                          className={active ? "rounded-[0.55rem] border border-[#2a313b] bg-[#1a2028] px-3 py-1 text-[0.75rem] font-semibold text-white" : "rounded-[0.55rem] px-3 py-1 text-[0.75rem] font-semibold text-[#6f7a8f] transition hover:text-white"}
                          key={code}
                          onClick={() => setCurrencyOverride(code)}
                          type="button"
                        >
                          {code}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null;

            const quantityOrAmountFields =
              mode === "DIVIDEND" ? (
                <>
                  <Field label="Monto recibido">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[0.8125rem] font-semibold text-[#7f8aa3] md:text-[0.82rem]">$</span>
                      <input className="w-full bg-transparent text-[0.875rem] font-semibold text-white outline-none placeholder:text-[#6f7a8f] md:text-[0.98rem] md:tracking-[-0.03em]" inputMode="decimal" onChange={(event) => setDividendAmount(event.target.value)} placeholder="0.00" step="any" type="number" value={dividendAmount} />
                    </div>
                  </Field>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Fecha ex-dividendo (opcional)">
                      <input className="w-full bg-transparent text-[0.875rem] font-medium text-white outline-none md:text-[0.92rem]" onChange={(event) => setExDividendDate(event.target.value)} type="date" value={exDividendDate} />
                    </Field>
                    <Field label="Retención fiscal (opcional)">
                      <input className="w-full bg-transparent text-[0.875rem] font-medium text-white outline-none placeholder:text-[#6f7a8f] md:text-[0.92rem]" inputMode="decimal" onChange={(event) => setTaxWithheld(event.target.value)} placeholder="0.00" step="any" type="number" value={taxWithheld} />
                    </Field>
                  </div>
                </>
              ) : isBondBuy ? (
                <Field label="Monto a invertir">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[0.8125rem] font-semibold text-[#7f8aa3] md:text-[0.82rem]">$</span>
                    <input className="w-full bg-transparent text-[0.875rem] font-semibold text-white outline-none placeholder:text-[#6f7a8f] md:text-[1rem] md:tracking-[-0.03em]" inputMode="decimal" onChange={(event) => setInvestAmount(event.target.value)} placeholder="0.00" step="any" type="number" value={investAmount} />
                  </div>
                </Field>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Quantity">
                    <input className="w-full bg-transparent text-[0.875rem] font-semibold text-white outline-none placeholder:text-[#6f7a8f] md:text-[1rem] md:tracking-[-0.03em]" inputMode="decimal" onChange={(event) => setQuantity(event.target.value)} placeholder="0.00" step="any" type="number" value={quantity} />
                  </Field>
                  <Field label={mode === "TRANSFER" ? "Reference Price" : assetFieldType === "STOCK" ? "Price Per Share" : assetFieldType === "GOVERNMENT_BOND" ? "Precio de Compra" : "Price Per Coin"}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[0.8125rem] font-semibold text-[#7f8aa3] md:text-[0.82rem]">$</span>
                      <input className="w-full bg-transparent text-[0.875rem] font-semibold text-white outline-none placeholder:text-[#6f7a8f] disabled:text-[#6f7a8f]/60 md:text-[0.98rem] md:tracking-[-0.03em]" disabled={mode === "TRANSFER"} inputMode="decimal" onChange={(event) => setPricePerUnit(event.target.value)} placeholder={priceLoading ? "Loading..." : "0.00"} step="any" type="number" value={pricePerUnit} />
                    </div>
                  </Field>
                </div>
              );

            const bondDetails = isBondBuy ? (
              <div className="space-y-2 rounded-[0.875rem] border border-[#232931] bg-[#14191f] p-2.5 md:rounded-[0.95rem]">
                {bondUnitPrice !== null ? (
                  <p className="text-[0.76rem] font-medium text-[#9daccc]">
                    <span className="font-semibold uppercase tracking-[0.1em] text-[#6f7a8f]">Bono</span>{" "}
                    · {bondTitulos} título{bondTitulos === 1 ? "" : "s"} a {formatCurrencyByCode(bondUnitPrice, currency)} c/u
                    {bondRate !== undefined ? ` · tasa ${bondRate.toFixed(2)}%` : ""}
                  </p>
                ) : (
                  <p className="text-[0.76rem] text-[#6f7a8f]">Cargando tasa vigente...</p>
                )}
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  <Field label="Vencimiento">
                    <input className="w-full bg-transparent text-[0.8rem] font-medium text-white outline-none md:text-[0.92rem]" onChange={(event) => setMaturityDate(event.target.value)} type="date" value={maturityDate} />
                  </Field>
                  <Field label="Tasa cupon % (0=cero)">
                    <input className="w-full bg-transparent text-[0.8rem] font-medium text-white outline-none md:text-[0.92rem]" inputMode="decimal" onChange={(event) => setCouponRate(event.target.value)} placeholder="0" step="any" type="number" value={couponRate} />
                  </Field>
                </div>
                <label className="flex items-center justify-between rounded-[0.875rem] border border-[#232931] bg-[#181d24] px-3 py-1.5 md:rounded-[0.95rem]">
                  <span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.68rem]">Reinversión automática</span>
                  <button className={autoReinvestment ? "rounded-full bg-[#3f8c53] px-2.5 py-1 text-[0.72rem] font-semibold text-white" : "rounded-full bg-[#232931] px-2.5 py-1 text-[0.72rem] font-semibold text-[#7f8aa3]"} onClick={() => setAutoReinvestment((value) => !value)} type="button">
                    {autoReinvestment ? "Si" : "No"}
                  </button>
                </label>
                {faceValueValue > 0 ? (
                  <p className="text-[0.76rem] font-medium text-[#9daccc]">
                    Ganancia estimada: <span className={estimatedBondGain >= 0 ? "font-semibold text-[#17c784]" : "font-semibold text-[#ff6b6b]"}>{formatCurrencyByCode(estimatedBondGain, currency)}</span>
                  </p>
                ) : null}
              </div>
            ) : null;

            const brokerField =
              mode !== "TRANSFER" ? (
                <Field label="Broker (opcional)">
                  <input className="w-full bg-transparent text-[0.875rem] font-medium text-white outline-none placeholder:text-[#6f7a8f] md:text-[0.92rem]" onChange={(event) => setBroker(event.target.value)} placeholder={brokerPlaceholder} value={broker} />
                </Field>
              ) : null;

            const dateFeeNotesRow = (
              <div className="grid grid-cols-[1.3fr_0.6fr_0.75fr] gap-1.5 md:gap-2">
                <div className="block min-w-0 rounded-[0.875rem] border border-[#232931] bg-[#14191f] px-2.5 py-1.5 md:rounded-[0.95rem]">
                  <span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.68rem]">Date</span>
                  <div className="mt-1 min-w-0">
                    <DateTimePicker max={createDefaultDateTime()} onChange={setTransactionDate} value={transactionDate} />
                  </div>
                </div>
                {mode === "DIVIDEND" ? (
                  <div className="col-span-2 flex items-center justify-end">
                    <button className="rounded-[0.875rem] border border-[#232931] bg-[#14191f] px-3 py-1.5 text-left transition hover:border-[#2f3742] hover:bg-[#181d24] md:rounded-[0.95rem]" onClick={() => setView("notes")} type="button">
                      <span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.68rem]">Notes</span>
                      <p className="mt-1 line-clamp-2 text-[0.875rem] font-medium text-white md:text-[0.84rem]">{notes.trim() ? notes : "Add notes"}</p>
                    </button>
                  </div>
                ) : (
                  <>
                    <button className="rounded-[0.875rem] border border-[#232931] bg-[#14191f] px-3 py-1.5 text-left transition hover:border-[#2f3742] hover:bg-[#181d24] md:rounded-[0.95rem]" onClick={() => setView("fee")} type="button">
                      <span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.68rem]">{usesSplit ? "Costos" : "Fee"}</span>
                      <p className="mt-1 text-[0.875rem] font-medium text-white md:text-[0.84rem]">{effectiveFeeValue > 0 ? formatFeeCurrency(effectiveFeeValue, currency) : usesSplit ? "Comisión / IVA" : "Add fee"}</p>
                    </button>
                    <button className="rounded-[0.875rem] border border-[#232931] bg-[#14191f] px-3 py-1.5 text-left transition hover:border-[#2f3742] hover:bg-[#181d24] md:rounded-[0.95rem]" onClick={() => setView("notes")} type="button">
                      <span className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.68rem]">Notes</span>
                      <p className="mt-1 line-clamp-2 text-[0.875rem] font-medium text-white md:text-[0.84rem]">{notes.trim() ? notes : "Add notes"}</p>
                    </button>
                  </>
                )}
              </div>
            );

            const totalSpentSection = (
              <section className="mt-2 bg-transparent px-0 py-0 md:mt-0 md:rounded-[0.95rem] md:border md:border-[#1b2028] md:bg-[#101418] md:px-3.5 md:py-1.5">
                <p className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.66rem]">{mode === "DIVIDEND" ? "Monto recibido" : totalLabel}</p>
                <p className="mt-1 text-[1rem] font-semibold text-white md:mt-1.5 md:text-[1.08rem] md:tracking-[-0.04em]">
                  {mode === "DIVIDEND"
                    ? formatCurrencyByCode(dividendAmountValue, currency)
                    : mode === "TRANSFER"
                      ? `${formatEditableNumber(quantityValue)} ${selectedAsset?.symbol ?? "units"}`
                      : formatCurrencyByCode(totalValue, currency)}
                </p>
              </section>
            );

            const submitButton = (
              <button className={`w-full rounded-[0.82rem] px-4 py-2.5 text-[0.875rem] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-55 md:text-[0.92rem] ${isEditing ? "bg-[#3861fb] hover:bg-[#4f74ff]" : "bg-[#3f8c53] hover:bg-[#4a9b5f]"}`} disabled={submitDisabled} onClick={handleSubmit} type="button">
                {submitting ? (isEditing ? "Saving changes..." : "Saving transaction...") : submitLabel}
              </button>
            );

            if (isBondBuy) {
              return (
                <div className="md:grid md:grid-cols-2 md:items-start md:gap-4">
                  <div className="space-y-2">
                    {assetRow}
                    {quantityOrAmountFields}
                    {bondDetails}
                  </div>
                  <div className="mt-2 space-y-2 md:mt-0">
                    {brokerField}
                    {dateFeeNotesRow}
                    <ProblemAlert message={error} />
                    {totalSpentSection}
                    {submitButton}
                  </div>
                </div>
              );
            }

            return (
              <>
                {assetRow}
                {currencyToggle}
                {quantityOrAmountFields}
                {bondDetails}
                {brokerField}
                {dateFeeNotesRow}
                {splitPreview ? <SplitPreviewNotice preview={splitPreview} currency={currency} /> : null}
                <ProblemAlert message={error} />
                {totalSpentSection}
                {submitButton}
              </>
            );
          })()}
        </div>
      ) : null}
    </Modal>
  );
}

function OriginSelectionView({ onClose, onSelect, stepLabel, trigger }: { onClose: () => void; onSelect: (origin: DataOrigin) => void; stepLabel: string; trigger: "activo" | "transaction" }) {
  const verb = trigger === "transaction" ? "registrar tu operación" : "agregar tu activo";
  const choices: { id: DataOrigin; title: string; description: string; icon: ReactNode; badgeClassName: string }[] = [
    {
      id: "auto",
      title: "Sincronización Automática",
      description: "Integraciones, APIs y PDFs. Importa desde GBM, Binance, OKX, Interactive Brokers y más.",
      icon: <AutoSyncIcon className="h-5 w-5" />,
      badgeClassName: "bg-[#0f1d1b] text-[#17c784]",
    },
    {
      id: "manual",
      title: "Registro Manual Tradicional",
      description: "Elige la clase de activo y captura la operación tú mismo, con precarga al precio de mercado.",
      icon: <ManualEntryIcon className="h-5 w-5" />,
      badgeClassName: "bg-[#101722] text-[#60a5fa]",
    },
  ];
  return (
    <div className="flex max-h-[90vh] flex-col md:max-h-[78vh]">
      <SelectorHeader onClose={onClose} stepLabel={stepLabel} title="Origen de Datos" />
      <div className="hidden px-7 pb-5 pt-5 md:block">
        <p className="text-center text-[1.04rem] font-medium text-white">¿Cómo quieres {verb}?</p>
        <p className="mt-1 text-center text-sm text-[#6f7a8f]">Elige la filosofía de carga.</p>
      </div>
      <div className="hide-scrollbar min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 pb-4 pt-3 md:space-y-3 md:px-7 md:pb-7 md:pt-0">
        {choices.map((choice) => (
          <button
            className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-[0.9rem] border border-[#1b2028] bg-[#101418] px-3.5 py-3.5 text-left transition hover:border-[#2a313b] hover:bg-[#14191f] md:gap-4 md:rounded-[1.05rem] md:px-4 md:py-4"
            key={choice.id}
            onClick={() => onSelect(choice.id)}
            type="button"
          >
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.85rem] md:h-12 md:w-12 ${choice.badgeClassName}`}>
              {choice.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[0.92rem] font-semibold text-white md:text-[0.98rem]">{choice.title}</p>
              <p className="mt-1 text-[0.76rem] leading-[1.45] text-[#7f8aa3] md:text-[0.8rem]">{choice.description}</p>
            </div>
            <span aria-hidden="true" className="text-[1.1rem] leading-none text-[#7f8aa3] transition group-hover:translate-x-0.5 group-hover:text-white md:text-lg">&rsaquo;</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProviderSelectionView({ onBack, onClose, onSelect, stepLabel }: { onBack: () => void; onClose: () => void; onSelect: (providerId: string) => void; stepLabel: string }) {
  return (
    <div className="flex max-h-[90vh] flex-col md:max-h-[78vh]">
      <SelectorHeader onBack={onBack} onClose={onClose} stepLabel={stepLabel} title="Sincronización Automática" />
      <div className="hidden px-7 pb-5 pt-5 md:block">
        <p className="text-center text-[1.04rem] font-medium text-white">Conecta una fuente y deja que importe por ti</p>
        <p className="mt-1 text-center text-sm text-[#6f7a8f]">GBM está disponible hoy.</p>
      </div>
      <div className="hide-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-4 pt-3 md:space-y-2.5 md:px-7 md:pb-7 md:pt-0">
        {DATA_PROVIDERS.map((provider) => (
          <button
            className={`group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-[0.85rem] border px-3.5 py-3 text-left transition md:rounded-[0.95rem] ${
              provider.available
                ? "border-[#1b2028] bg-[#101418] hover:border-[#2a313b] hover:bg-[#14191f]"
                : "cursor-default border-[#161b22] bg-[#0c1015] opacity-60"
            }`}
            disabled={!provider.available}
            key={provider.id}
            onClick={() => provider.available && onSelect(provider.id)}
            type="button"
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.8rem] ${provider.available ? "bg-[#0f1d1b] text-[#17c784]" : "bg-[#141821] text-[#7f8aa3]"}`}>
              <ProviderIcon id={provider.id} className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[0.88rem] font-semibold text-white md:text-[0.92rem]">{provider.title}</p>
              <p className="mt-0.5 truncate text-[0.72rem] text-[#7f8aa3] md:text-[0.76rem]">{provider.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] md:text-[0.64rem] ${provider.available ? "bg-[#0f2a1e] text-[#17c784]" : "bg-[#1e2535] text-[#7f8aa3]"}`}>
                {provider.available ? "Activo" : "Próximamente"}
              </span>
              {provider.available ? <span aria-hidden="true" className="text-[1rem] leading-none text-[#7f8aa3] transition group-hover:translate-x-0.5 group-hover:text-white md:text-lg">&rsaquo;</span> : null}
            </div>
          </button>
        ))}
        <p className="pt-1 text-center text-[0.78rem] text-[#5f6d82]">¿No ves tu exchange preferido? Escríbenos.</p>
      </div>
    </div>
  );
}

function AssetTypeSelectionView({ filters, onBack, onClose, onSelect, stepLabel }: { filters: SelectorFilter[]; onBack?: () => void; onClose: () => void; onSelect: (filter: SelectorFilter) => void; stepLabel: string }) {
  return (
    <div className="flex max-h-[90vh] flex-col md:max-h-[78vh]">
      <SelectorHeader onBack={onBack} onClose={onClose} stepLabel={stepLabel} title="Tipo de Activo" />
      <div className="hidden px-7 pb-6 pt-6 md:block">
        <p className="text-center text-[1.04rem] font-medium text-white">Selecciona la clase de activo que deseas registrar</p>
      </div>
      <div className="hide-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto px-4 pb-4 md:space-y-1.5 md:px-7 md:pb-7">
        {filters.map((filter) => {
          const card = getAssetTypeCard(filter);
          return (
            <button
              className="grid h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[0.625rem] border border-transparent bg-[#101418] px-3 py-2 text-left transition hover:border-[#232931] hover:bg-[#14191f] md:h-auto md:rounded-[0.9rem] md:py-3"
              key={filter}
              onClick={() => onSelect(filter)}
              type="button"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full md:h-9 md:w-9 ${card.badgeClassName}`}>
                  {card.icon}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[0.875rem] font-medium text-white md:text-[0.92rem]">{card.title}</p>
                  <p className="mt-0.5 truncate text-[0.6875rem] text-[#6f7a8f] md:text-[0.72rem]">{card.description}</p>
                </div>
              </div>
              <span aria-hidden="true" className="text-[1rem] leading-none text-[#7f8aa3] md:text-lg">&rsaquo;</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AssetSelectorView({ activeFilter, assets, filters, loading, lockedAssetType, onBack, onClose, onFilterChange, onQueryChange, onSelect, popularAssets, portfolioLabel, query, recentAssets, showFilterTabs, stepLabel }: { activeFilter: SelectorFilter; assets: AssetOption[]; filters: SelectorFilter[]; loading: boolean; lockedAssetType?: string; onBack?: () => void; onClose: () => void; onFilterChange: (value: SelectorFilter) => void; onQueryChange: (value: string) => void; onSelect: (asset: AssetOption) => void; popularAssets: PopularAssets; portfolioLabel: string; query: string; recentAssets: AssetOption[]; showFilterTabs: boolean; stepLabel: string }) {
  if (activeFilter === "CRYPTO") return <div className="flex max-h-[90vh] flex-col md:max-h-[78vh]"><SelectorHeader onBack={onBack} onClose={onClose} stepLabel={stepLabel} title="Seleccionar Activo" /><CryptoSelector heading={<><p className="hidden text-center text-[1.04rem] font-medium text-white md:block">Selecciona una moneda para registrar tu operación</p><p className="mt-1 hidden text-center text-sm text-[#6f7a8f] md:block">{portfolioLabel} wallet</p></>} onChange={(crypto) => onSelect({ assetId: crypto.id, symbol: crypto.symbol.toUpperCase(), name: crypto.name, assetType: "CRYPTO", logoUrl: crypto.image ?? `https://assets.coingecko.com/coins/images/1/small/${crypto.id}.png`, supportedForTransactions: true, suggestedPrice: crypto.currentPrice })} value={null} /></div>;

  const isBrowseMode = !query.trim();
  const visibleRecent = filterAssetsByType(recentAssets, activeFilter);
  const categorySections: { label: string; assets: AssetOption[] }[] =
    activeFilter === "ALL"
      ? [
          { label: "Acciones", assets: popularAssets.stocks },
          { label: "ETFs", assets: popularAssets.etfs },
          { label: "Cripto", assets: popularAssets.cryptos },
          { label: "Bonos Gobierno", assets: popularAssets.governmentBonds },
        ]
      : [{ label: "Populares", assets }];

  return <div className="flex max-h-[90vh] flex-col md:max-h-[78vh]"><SelectorHeader onBack={onBack} onClose={onClose} stepLabel={stepLabel} title="Seleccionar Activo" /><div className="px-4 pb-3 md:px-7 md:pb-6 md:pt-6"><p className="hidden text-center text-[1.04rem] font-medium text-white md:block">Selecciona un activo para registrar tu operación</p><p className="mt-1 hidden text-center text-sm text-[#6f7a8f] md:block">{portfolioLabel} wallet</p><div className="mt-0 rounded-[0.875rem] border border-[#252c36] bg-[#14191f] px-3 py-2 md:mt-5 md:rounded-[0.85rem] md:px-4 md:py-3"><div className="flex items-center gap-3"><Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[#6f7a8f]" /><input aria-label="Buscar activo" className="w-full bg-transparent text-[0.875rem] text-white outline-none placeholder:text-[#6f7a8f] md:text-[0.92rem]" onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar símbolo, empresa o activo" value={query} />{query ? <button className="text-[0.8125rem] font-medium text-[#7f8aa3] transition hover:text-white md:text-sm" onClick={() => onQueryChange("")} type="button">Limpiar</button> : null}</div></div>{showFilterTabs ? <div className="mt-3 flex flex-wrap gap-1.5 md:mt-4 md:gap-2">{filters.map((filter) => { const active = filter === activeFilter; return <button className={active ? "h-7 rounded-xl border border-[#2a313b] bg-[#1a2028] px-3 text-[0.75rem] font-semibold text-white md:h-auto md:rounded-full md:px-3.5 md:py-2 md:text-[0.76rem]" : "h-7 rounded-xl border border-[#1b2028] bg-[#101418] px-3 text-[0.75rem] font-semibold text-[#6f7a8f] transition hover:border-[#2a313b] hover:text-white md:h-auto md:rounded-full md:px-3.5 md:py-2 md:text-[0.76rem]"} disabled={Boolean(lockedAssetType)} key={filter} onClick={() => onFilterChange(filter)} type="button">{getFilterLabel(filter)}</button>; })}</div> : null}</div><div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-7 md:pb-7">
    {isBrowseMode ? (
      <div className="space-y-4">
        {visibleRecent.length ? (
          <AssetGroupSection assets={visibleRecent} label="Recientes" onSelect={onSelect} />
        ) : null}
        {categorySections
          .filter((section) => section.assets.length)
          .map((section) => (
            <AssetGroupSection assets={section.assets} key={section.label} label={section.label} onSelect={onSelect} />
          ))}
        {!visibleRecent.length && !categorySections.some((section) => section.assets.length) ? (
          <p className="px-2 py-4 text-[0.8125rem] text-[#6f7a8f] md:py-5 md:text-sm">Cargando activos populares...</p>
        ) : null}
      </div>
    ) : (
      <>
        <div className="grid grid-cols-[1fr_auto] gap-4 px-2 pb-2 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.72rem]"><span>Activo</span><span>Clase</span></div>
        {loading ? <p className="px-2 py-4 text-[0.8125rem] text-[#6f7a8f] md:py-5 md:text-sm">Buscando activos...</p> : null}
        {!loading && !assets.length ? <p className="px-2 py-4 text-[0.8125rem] text-[#6f7a8f] md:py-5 md:text-sm">No se encontraron activos para esa búsqueda.</p> : null}
        <div className="space-y-1 md:space-y-1.5">{assets.map((asset) => <AssetRow asset={asset} key={`${asset.symbol}-${asset.assetType}`} onSelect={onSelect} />)}</div>
      </>
    )}
  </div></div>;
}

function AssetGroupSection({ assets, label, onSelect }: { assets: AssetOption[]; label: string; onSelect: (asset: AssetOption) => void }) {
  return (
    <div>
      <p className="px-2 pb-2 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.72rem]">{label}</p>
      <div className="space-y-1 md:space-y-1.5">
        {assets.map((asset) => (
          <AssetRow asset={asset} key={`${label}-${asset.symbol}-${asset.assetType}`} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function AssetRow({ asset, onSelect }: { asset: AssetOption; onSelect: (asset: AssetOption) => void }) {
  const disabled = !asset.supportedForTransactions;
  return (
    <button
      className={`grid h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[0.625rem] border border-transparent bg-[#101418] px-3 py-2 text-left transition md:h-auto md:rounded-[0.9rem] md:py-3 ${disabled ? "cursor-not-allowed opacity-50" : "hover:border-[#232931] hover:bg-[#14191f]"}`}
      disabled={disabled}
      onClick={() => onSelect(asset)}
      title={disabled ? "Solo consulta, no transaccionable" : undefined}
      type="button"
    >
      <div className="flex min-w-0 items-center gap-3">
        <AssetAvatar assetType={asset.assetType} dark symbol={asset.symbol} logoUrl={asset.logoUrl} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 md:gap-x-2.5">
            <span className="truncate text-[0.875rem] font-medium text-white md:text-[0.92rem]">{asset.name}</span>
            <span className="text-[0.6875rem] text-[#7f8aa3] md:text-[0.8rem]">{asset.symbol}</span>
          </div>
          <p className="mt-0.5 truncate text-[0.6875rem] text-[#6f7a8f] md:text-[0.72rem]">{disabled ? "Solo consulta, no transaccionable" : asset.name}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[0.8125rem] text-[#6f7a8f] md:gap-2.5 md:text-sm">
        <span className="rounded-full border border-[#232931] bg-[#14191f] px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-[#9daccc] md:px-2.5 md:py-1 md:text-[0.64rem] md:tracking-[0.16em]">{getFilterLabel(normalizeAssetType(asset.assetType) as SelectorFilter)}</span>
        {!disabled ? <span className="text-[1rem] leading-none text-[#7f8aa3] md:text-lg">&rsaquo;</span> : null}
      </div>
    </button>
  );
}

function SelectorHeader({ onBack, onClose, stepLabel, title }: { onBack?: () => void; onClose: () => void; stepLabel: string; title: string }) {
  return <header className="px-4 py-3 md:px-7 md:pb-5 md:pt-6"><div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">{onBack ? <button className="rounded-full p-1.5 text-[1.125rem] leading-none text-[#7f8aa3] transition hover:bg-[#171d27] hover:text-white md:p-2 md:text-[1.45rem]" onClick={onBack} type="button"><span aria-hidden="true">&lsaquo;</span></button> : <span className="h-8 w-8 md:h-9 md:w-9" aria-hidden="true" />}<div className="text-center"><h2 className="text-[1.125rem] font-semibold text-white md:text-[1.16rem] md:tracking-[-0.03em]">{title}</h2><p className="mt-0.5 text-[0.6875rem] text-[#6f7a8f] md:mt-1 md:text-sm">{stepLabel}</p></div><button className="rounded-full p-1.5 text-[1.125rem] leading-none text-[#7f8aa3] transition hover:bg-[#171d27] hover:text-white md:p-2 md:text-[1.7rem]" onClick={onClose} type="button"><span aria-hidden="true">&times;</span></button></div><StepRail stepLabel={stepLabel} /></header>;
}

// Progress rail for the guided wizard: one segment per real step, filling as the
// user advances. Completed segments snap solid; only the current one animates in
// (so arriving at a step reads as "the next segment fills", not a reset). The
// step count is parsed from the "Paso X de Y" label, so no extra prop threading.
function parseStepProgress(stepLabel: string): { current: number; total: number } | null {
  const match = /Paso\s+(\d+)\s+de\s+(\d+)/.exec(stepLabel);
  if (!match) return null;
  const current = Number(match[1]);
  const total = Number(match[2]);
  return total > 1 && current >= 1 && current <= total ? { current, total } : null;
}

function StepRail({ stepLabel, className = "" }: { stepLabel: string; className?: string }) {
  const progress = parseStepProgress(stepLabel);
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!progress) return null;
  const { current, total } = progress;
  return (
    <div
      aria-label={stepLabel}
      aria-valuemax={total}
      aria-valuemin={1}
      aria-valuenow={current}
      className={`mt-3 flex items-center gap-1.5 md:mt-3.5 ${className}`}
      role="progressbar"
    >
      {Array.from({ length: total }, (_, index) => {
        const isCurrent = index === current - 1;
        const active = index < current && (!isCurrent || filled);
        return (
          <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-[#1b2230]" key={index}>
            <span
              className={`absolute inset-0 origin-left rounded-full bg-[linear-gradient(90deg,#1fd38b,#0f9e67)] ${isCurrent ? "transition-transform duration-[600ms] ease-out motion-reduce:transition-none" : ""}`}
              style={{ transform: `scaleX(${active ? 1 : 0})` }}
            />
          </span>
        );
      })}
    </div>
  );
}

function SimpleEditor({ children, cta, onBack, stepLabel, title }: { children: ReactNode; cta: string; onBack: () => void; stepLabel: string; title: string }) {
  return <div className="space-y-3 md:space-y-5"><header className="flex items-center gap-2.5 pr-8"><button className="rounded-full p-1.5 text-[1.125rem] leading-none text-[#7f8aa3] transition hover:bg-[#14191f] hover:text-white md:p-2 md:text-[1.7rem]" onClick={onBack} type="button"><span aria-hidden="true">&lsaquo;</span></button><div><h2 className="text-[1.125rem] font-semibold text-white md:text-[1.25rem] md:tracking-[-0.03em]">{title}</h2><p className="mt-0.5 text-[0.6875rem] text-[#6f7a8f] md:mt-1 md:text-sm">{stepLabel}</p></div></header><StepRail stepLabel={stepLabel} className="-mt-1" />{children}<button className="w-full rounded-[0.82rem] bg-[#3f8c53] px-4 py-2.5 text-[0.875rem] font-semibold text-white transition hover:bg-[#4a9b5f] md:px-5 md:py-3 md:text-[0.92rem]" onClick={onBack} type="button">{cta}</button></div>;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="block rounded-[0.875rem] border border-[#232931] bg-[#14191f] px-3 py-1.5 md:rounded-[0.95rem] md:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]"><span className="block text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.66rem]">{label}</span><div className="mt-0.5">{children}</div></label>;
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

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// CETES symbols encode their term in days (CETES28, CETES91, CETES182, ...).
function parseCetesTermDays(symbol: string) {
  const match = symbol.match(/(\d+)/);
  if (!match) return null;
  const days = Number(match[1]);
  return Number.isFinite(days) && days > 0 ? days : null;
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

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
    case "GOVERNMENT_BOND": return "Bonos Gob.";
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
    case "GOVERNMENT_BOND": return "Bonos Gobierno";
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
    case "GOVERNMENT_BOND":
      return {
        title: "Bonos Gobierno",
        description: "CETES, UDIBONO, BONDM",
        badgeClassName: "bg-[#1a1712] text-[#e9b872]",
        icon: <BondAssetIcon className="h-5 w-5" />,
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

function buildMergedSuggestions(assets: AssetOption[], logoRegistry: AssetLogoRegistry) {
  const map = new Map<string, AssetOption>();
  assets.forEach((asset) => {
    if (!asset?.symbol) return;
    const assetType = normalizeAssetType(asset.assetType) ?? asset.assetType;
    const logoUrl = asset.logoUrl ?? getAssetLogoFromRegistry(logoRegistry, asset.symbol, asset.assetType);
    map.set(`${asset.symbol}-${assetType}`, { ...asset, assetType, logoUrl });
  });
  return Array.from(map.values());
}

function AutoSyncIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M13 2 4 13h6l-1 9 10-12h-6l1-8z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ManualEntryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 20h9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ProviderIcon({ id, className }: { id: string; className?: string }) {
  switch (id) {
    case "gbm":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24">
          <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
          <path d="M14 3v4h4M9 16l2.2 2.2L15 14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        </svg>
      );
    case "wallet":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24">
          <path d="M3 10h18M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
          <circle cx="17" cy="15" fill="currentColor" r="1" />
        </svg>
      );
    case "okx":
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <rect height="6" width="6" x="2" y="9" /><rect height="6" width="6" x="9" y="2" />
          <rect height="6" width="6" x="9" y="16" /><rect height="6" width="6" x="16" y="9" />
        </svg>
      );
    case "binance":
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2l2.4 2.4-7.6 7.6-2.4-2.4L12 2zM4.8 9.6l2.4 2.4-2.4 2.4-2.4-2.4 2.4-2.4zm14.4 0l2.4 2.4-2.4 2.4-2.4-2.4 2.4-2.4zm-7.2 2.4l2.4 2.4-7.6 7.6-2.4-2.4 7.6-7.6zm2.4 2.4l2.4-2.4 2.4 2.4-2.4 2.4-2.4-2.4z" />
        </svg>
      );
    default: // ibkr and any future API provider
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24">
          <path d="M5 18.5h14M6.5 16V9.5M11.5 16V6.5M16.5 16v-4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M6 9l3-2.5 3.2 1.7 4-4.2 1.8 1.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      );
  }
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

function BondAssetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M4 9.5 12 5l8 4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M5.5 9.5v8M9.5 9.5v8M14.5 9.5v8M18.5 9.5v8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M4 19h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}
