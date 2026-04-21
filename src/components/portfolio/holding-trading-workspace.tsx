"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { IChartApi, MouseEventParams, Time, UTCTimestamp } from "lightweight-charts";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createBuyTransaction, createSellTransaction } from "@/features/transactions/api/create-transaction";
import { getAssetLogoFromRegistry, readAssetLogoRegistry, type AssetLogoRegistry } from "@/features/assets/lib/asset-logo-registry";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";
import { getAssetPrice } from "@/features/marketdata/api/get-asset-price";
import type { TransactionResponse } from "@/features/transactions/types/transaction.types";
import { formatCurrency, formatQuantity, formatSignedCurrency } from "@/lib/utils/format";

type TradeRange = "1D" | "1W" | "1M" | "YTD" | "ALL";
type TradeMode = "BUY" | "SELL";

type TradeObservation = {
  timestamp: number;
  price: number;
  quantity: number;
};

type TradeCandle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const RANGE_OPTIONS: Array<{ key: TradeRange; label: string }> = [
  { key: "1D", label: "1D" },
  { key: "1W", label: "1W" },
  { key: "1M", label: "1M" },
  { key: "YTD", label: "YTD" },
  { key: "ALL", label: "All" },
];

const POSITIVE = "#16c784";
const NEGATIVE = "#ff5b6e";
const GRID = "#1a2029";
const EMPTY_CANDLES: TradeCandle[] = [];

const transactionSchema = z.object({
  quantity: z
    .string()
    .min(1, "La cantidad es obligatoria.")
    .refine((value) => Number(value) > 0, "La cantidad debe ser mayor a cero."),
  pricePerUnit: z
    .string()
    .min(1, "El precio es obligatorio.")
    .refine((value) => Number(value) > 0, "El precio debe ser mayor a cero."),
  fee: z
    .string()
    .optional()
    .refine((value) => value === undefined || value === "" || Number(value) >= 0, "La comision no puede ser negativa."),
  transactionDate: z.string().min(1, "La fecha es obligatoria."),
  notes: z.string().max(240, "Las notas no deben exceder 240 caracteres.").optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

export function HoldingTradingWorkspace({
  entry,
  transactions,
  onRecorded,
}: {
  entry: PortfolioEntry;
  transactions: TransactionResponse[];
  onRecorded: () => Promise<void> | void;
}) {
  const [range, setRange] = useState<TradeRange>("ALL");
  const [mode, setMode] = useState<TradeMode>("BUY");
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    date: string;
    close: string;
    volume: string;
  }>({ visible: false, x: 0, y: 0, date: "", close: "", volume: "" });
  const [logoRegistry, setLogoRegistry] = useState<AssetLogoRegistry>({});
  const [priceError, setPriceError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const chartShellRef = useRef<HTMLDivElement | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  const currentPrice = useMemo(() => {
    const quantity = Number(entry.totalQuantity);
    const currentValue = Number(entry.currentValue);
    return quantity > 0 ? currentValue / quantity : Number(entry.averagePricePerUnit);
  }, [entry.averagePricePerUnit, entry.currentValue, entry.totalQuantity]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      quantity: "",
      pricePerUnit: currentPrice > 0 ? currentPrice.toFixed(2) : "",
      fee: "",
      transactionDate: toDateTimeLocal(new Date()),
      notes: "",
    },
  });

  const quantityValue = Number(watch("quantity") || 0);
  const priceValue = Number(watch("pricePerUnit") || 0);
  const feeValue = Number(watch("fee") || 0);
  const grossValue = quantityValue > 0 && priceValue > 0 ? quantityValue * priceValue : 0;
  const netValue = grossValue + feeValue;
  const pnl = Number(entry.totalProfitLoss);
  const averageCost = Number(entry.averagePricePerUnit);
  const holdings = Number(entry.totalQuantity);

  const candles = useMemo(() => {
    const built = buildCandlesFromTransactions(transactions, currentPrice, range);
    return built.length ? built : EMPTY_CANDLES;
  }, [currentPrice, range, transactions]);

  useEffect(() => {
    setLogoRegistry(readAssetLogoRegistry());
  }, []);

  useEffect(() => {
    let active = true;

    if (currentPrice > 0) {
      setValue("pricePerUnit", currentPrice.toFixed(2));
      return;
    }

    void getAssetPrice(entry.assetSymbol, entry.assetType)
      .then((price) => {
        if (!active || !Number.isFinite(price) || price <= 0) return;
        setPriceError(null);
        setValue("pricePerUnit", price.toFixed(2));
      })
      .catch(() => {
        if (!active) return;
        setPriceError(`No fue posible cargar el precio actual de ${entry.assetSymbol}.`);
      });

    return () => {
      active = false;
    };
  }, [currentPrice, entry.assetSymbol, entry.assetType, setValue]);

  useEffect(() => {
    let disposed = false;
    let chart: IChartApi | null = null;
    let resizeObserver: ResizeObserver | null = null;

    async function mountChart() {
      if (!chartContainerRef.current || !chartShellRef.current || candles.length === 0) {
        setTooltip((previous) => (previous.visible ? { ...previous, visible: false } : previous));
        return;
      }

      const charts = await import("lightweight-charts");
      if (disposed || !chartContainerRef.current || !chartShellRef.current) {
        return;
      }

      const container = chartContainerRef.current;
      const shell = chartShellRef.current;
      container.innerHTML = "";

      chart = charts.createChart(container, {
        autoSize: true,
        layout: {
          background: { type: charts.ColorType.Solid, color: "transparent" },
          textColor: "#97a3b8",
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: GRID, visible: true },
          horzLines: { color: GRID, visible: true },
        },
        crosshair: {
          mode: charts.CrosshairMode.Normal,
          vertLine: { color: "#28313e", labelBackgroundColor: "#171d25" },
          horzLine: { color: "#28313e", labelBackgroundColor: "#171d25" },
        },
        rightPriceScale: {
          borderVisible: false,
          scaleMargins: { top: 0.1, bottom: 0.24 },
        },
        timeScale: {
          borderVisible: false,
          fixLeftEdge: true,
          rightOffset: 6,
          timeVisible: range === "1D" || range === "1W",
        },
        handleScroll: true,
        handleScale: true,
      });

      const candleSeries = chart.addSeries(charts.CandlestickSeries, {
        upColor: POSITIVE,
        downColor: NEGATIVE,
        borderVisible: false,
        wickUpColor: POSITIVE,
        wickDownColor: NEGATIVE,
        priceLineVisible: true,
        priceLineColor: candles[candles.length - 1]?.close >= candles[0]?.open ? POSITIVE : NEGATIVE,
      });

      const volumeSeries = chart.addSeries(charts.HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "",
        color: "#1d2733",
      });

      candleSeries.setData(candles);
      volumeSeries.setData(
        candles.map((candle) => ({
          time: candle.time,
          value: candle.volume || 0,
          color: candle.close >= candle.open ? "rgba(22,199,132,0.22)" : "rgba(255,91,110,0.22)",
        })),
      );

      chart.priceScale("").applyOptions({
        scaleMargins: { top: 0.78, bottom: 0 },
      });
      chart.timeScale().fitContent();

      const crosshairHandler = (param: MouseEventParams<Time>) => {
        if (!param.point || !param.time || !shell) {
          setTooltip((previous) => (previous.visible ? { ...previous, visible: false } : previous));
          return;
        }

        const candle = param.seriesData.get(candleSeries) as { open?: number; high?: number; low?: number; close?: number } | undefined;
        if (!candle?.close) {
          setTooltip((previous) => (previous.visible ? { ...previous, visible: false } : previous));
          return;
        }

        const candleVolume = candles.find((item) => item.time === param.time)?.volume ?? 0;
        setTooltip({
          visible: true,
          x: param.point.x,
          y: param.point.y,
          date: formatTooltipDate(fromChartTime(param.time)),
          close: formatCurrency(candle.close),
          volume: formatQuantity(candleVolume),
        });
      };

      chart.subscribeCrosshairMove(crosshairHandler);
      resizeObserver = new ResizeObserver(() => chart?.timeScale().fitContent());
      resizeObserver.observe(shell);

      return () => {
        chart?.unsubscribeCrosshairMove(crosshairHandler);
      };
    }

    let cleanupHandler: (() => void) | undefined;
    void mountChart().then((cleanup) => {
      cleanupHandler = cleanup;
    });

    return () => {
      disposed = true;
      cleanupHandler?.();
      resizeObserver?.disconnect();
      chart?.remove();
    };
  }, [candles, range]);

  async function onSubmit(values: TransactionFormValues) {
    setSubmitting(true);
    setPriceError(null);

    try {
      const payload = {
        assetSymbol: entry.assetSymbol,
        assetType: entry.assetType,
        quantity: Number(values.quantity),
        pricePerUnit: Number(values.pricePerUnit),
        fee: values.fee ? Number(values.fee) : undefined,
        transactionDate: new Date(values.transactionDate).toISOString(),
        notes: values.notes?.trim() ? values.notes.trim() : undefined,
      };

      if (mode === "BUY") {
        await createBuyTransaction(payload);
      } else {
        await createSellTransaction(payload);
      }

      await onRecorded();
      reset({
        quantity: "",
        pricePerUnit: payload.pricePerUnit.toFixed(2),
        fee: "",
        transactionDate: toDateTimeLocal(new Date()),
        notes: "",
      });
    } catch (error) {
      setPriceError(error instanceof Error ? error.message : "No fue posible registrar la transaccion.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="overflow-hidden rounded-[1.65rem] bg-[#111317] shadow-[0_30px_84px_rgba(0,0,0,0.32)]">
        <div className="border-b border-[#1a1f29] px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <AssetOrb
                  logoUrl={getAssetLogoFromRegistry(logoRegistry, entry.assetSymbol, entry.assetType)}
                  symbol={entry.assetSymbol}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-[1.8rem] font-semibold tracking-[-0.05em] text-white">
                      {entry.assetSymbol}/USD
                    </h1>
                    <span className="rounded-[0.55rem] bg-[#0d2a1f] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#5de2aa]">
                      {entry.assetType}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.78rem] uppercase tracking-[0.2em] text-[#7f8aa3]">
                    Terminal de analisis del activo
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <WorkspaceStat label="Precio actual" value={formatCurrency(currentPrice)} />
                <WorkspaceStat label="Cantidad" value={`${formatQuantity(entry.totalQuantity)} ${entry.assetSymbol}`} />
                <WorkspaceStat label="Costo promedio" value={formatCurrency(averageCost)} />
                <WorkspaceStat label="Valor actual" value={formatCurrency(entry.currentValue)} />
                <WorkspaceStat
                  label="PnL"
                  tone={pnl >= 0 ? "positive" : "negative"}
                  value={formatSignedCurrency(entry.totalProfitLoss)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((option) => (
                <button
                  className={`rounded-[0.78rem] px-3.5 py-2 text-[0.82rem] font-semibold transition ${
                    option.key === range
                      ? "bg-[#171c24] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                      : "bg-[#0f1217] text-[#8f99ab] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] hover:text-white"
                  }`}
                  key={option.key}
                  onClick={() => setRange(option.key)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_270px]">
          <div className="border-r border-[#1a1f29]">
            <div className="border-b border-[#1a1f29] px-6 py-3 text-[0.75rem] font-semibold uppercase tracking-[0.18em] text-[#74829a]">
              Grafico del activo
            </div>
            <div className="relative px-4 pb-5 pt-4" ref={chartShellRef}>
              {tooltip.visible ? (
                <div
                  className="pointer-events-none absolute z-10 rounded-[0.95rem] bg-[#141922] px-3.5 py-3 shadow-[0_18px_36px_rgba(0,0,0,0.34)] ring-1 ring-[#202833]"
                  style={{
                    left: `clamp(18px, calc(${tooltip.x}px - 88px), calc(100% - 174px))`,
                    top: `clamp(14px, calc(${tooltip.y}px - 86px), calc(100% - 92px))`,
                  }}
                >
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#7f8aa3]">{tooltip.date}</p>
                  <p className="mt-2 text-[0.98rem] font-semibold text-white">{tooltip.close}</p>
                  <p className="mt-1 text-[0.76rem] text-[#90a0b8]">Volumen: {tooltip.volume}</p>
                </div>
              ) : null}

              <div className="mb-3 flex items-center justify-between px-2">
                <div className="text-[0.78rem] text-[#7f8aa3]">
                  Evolucion de {entry.assetSymbol} basada en tus movimientos y precio actual.
                </div>
                <div className="text-[0.78rem] font-medium text-[#7f8aa3]">
                  Holdings: <span className="text-white">{formatQuantity(holdings)}</span>
                </div>
              </div>

              {candles.length ? (
                <div className="h-[30rem] w-full" ref={chartContainerRef} />
              ) : (
                <div className="flex h-[30rem] items-center justify-center rounded-[1.2rem] bg-[#0d1015] text-center text-[0.9rem] text-[#7f8aa3] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                  Registra mas movimientos para visualizar este activo en modo terminal.
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#0f1217]">
            <div className="border-b border-[#1a1f29] px-5 py-4">
              <div className="inline-flex rounded-[0.9rem] bg-[#0c1015] p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                <ModeButton active={mode === "BUY"} label="Buy" onClick={() => setMode("BUY")} />
                <ModeButton active={mode === "SELL"} label="Sell" onClick={() => setMode("SELL")} />
              </div>
              <div className="mt-4 space-y-1">
                <p className="text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-[#7f8aa3]">
                  Panel de registro
                </p>
                <p className="text-[0.9rem] text-[#c7d0de]">
                  Registra operaciones reales del portfolio. No ejecuta ordenes de mercado.
                </p>
              </div>
            </div>

            <form className="space-y-4 px-5 py-5" id="transaction-panel" onSubmit={handleSubmit(onSubmit)}>
              <InfoRow label="Activo" value={`${entry.assetSymbol} / ${getAssetDisplayName(entry.assetSymbol)}`} />
              <InfoRow label="Disponible" value={`${formatQuantity(entry.totalQuantity)} ${entry.assetSymbol}`} />

              <Field label="Cantidad" error={errors.quantity?.message}>
                <input
                  className="h-12 w-full rounded-[0.95rem] bg-[#10141a] px-4 text-[0.95rem] text-white outline-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition placeholder:text-[#708098] focus:bg-[#131922]"
                  placeholder="0.00"
                  step="any"
                  type="number"
                  {...register("quantity")}
                />
              </Field>

              <Field label="Precio de ejecucion" error={errors.pricePerUnit?.message}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#708098]">$</span>
                  <input
                    className="h-12 w-full rounded-[0.95rem] bg-[#10141a] pl-8 pr-4 text-[0.95rem] text-white outline-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition placeholder:text-[#708098] focus:bg-[#131922]"
                    placeholder="0.00"
                    step="any"
                    type="number"
                    {...register("pricePerUnit")}
                  />
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Fee" error={errors.fee?.message}>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#708098]">$</span>
                    <input
                      className="h-12 w-full rounded-[0.95rem] bg-[#10141a] pl-8 pr-4 text-[0.95rem] text-white outline-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition placeholder:text-[#708098] focus:bg-[#131922]"
                      placeholder="0.00"
                      step="any"
                      type="number"
                      {...register("fee")}
                    />
                  </div>
                </Field>

                <Field label="Fecha" error={errors.transactionDate?.message}>
                  <input
                    className="h-12 w-full rounded-[0.95rem] bg-[#10141a] px-4 text-[0.95rem] text-white outline-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition focus:bg-[#131922]"
                    type="datetime-local"
                    {...register("transactionDate")}
                  />
                </Field>
              </div>

              <Field label="Notas" error={errors.notes?.message}>
                <textarea
                  className="min-h-[92px] w-full rounded-[0.95rem] bg-[#10141a] px-4 py-3 text-[0.95rem] text-white outline-none shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition placeholder:text-[#708098] focus:bg-[#131922]"
                  placeholder="Binance, compra escalonada, rebalanceo..."
                  {...register("notes")}
                />
              </Field>

              {priceError ? (
                <div className="rounded-[0.95rem] bg-[#341f24] px-4 py-3 text-[0.84rem] text-[#ffb5bf] shadow-[inset_0_0_0_1px_rgba(255,107,107,0.14)]">
                  {priceError}
                </div>
              ) : null}

              <div className="rounded-[1rem] bg-[#0c1015] px-4 py-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                <div className="flex items-center justify-between text-[0.82rem] text-[#7f8aa3]">
                  <span>Total estimado</span>
                  <span className="text-white">{formatCurrency(mode === "BUY" ? netValue : grossValue)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[0.78rem] text-[#708098]">
                  <span>{mode === "BUY" ? "Incluye fee" : "Monto bruto"}</span>
                  <span>
                    {quantityValue > 0 ? formatQuantity(quantityValue) : "0"} {entry.assetSymbol}
                  </span>
                </div>
              </div>

              <button
                className={`h-12 w-full rounded-[1rem] text-[0.95rem] font-semibold text-white shadow-[0_16px_34px_rgba(0,0,0,0.24)] transition ${
                  mode === "BUY" ? "bg-[#16c784] hover:bg-[#1bd48d]" : "bg-[#ff5b6e] hover:bg-[#ff6e7f]"
                } disabled:cursor-not-allowed disabled:opacity-55`}
                disabled={submitting}
                type="submit"
              >
                {submitting ? "Guardando..." : mode === "BUY" ? `Registrar compra` : `Registrar venta`}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}

function buildCandlesFromTransactions(transactions: TransactionResponse[], currentPrice: number, range: TradeRange) {
  const observations = buildObservations(transactions, currentPrice);
  if (!observations.length) return [];

  const filtered = filterObservationsByRange(observations, range);
  return bucketObservations(filtered.length > 1 ? filtered : observations.slice(-Math.min(observations.length, 24)), range);
}

function buildObservations(transactions: TransactionResponse[], currentPrice: number): TradeObservation[] {
  const ordered = [...transactions]
    .filter((transaction) => Number(transaction.pricePerUnit) > 0 && !Number.isNaN(new Date(transaction.transactionDate).getTime()))
    .sort((left, right) => new Date(left.transactionDate).getTime() - new Date(right.transactionDate).getTime())
    .map((transaction) => ({
      timestamp: new Date(transaction.transactionDate).getTime(),
      price: Number(transaction.pricePerUnit),
      quantity: Math.abs(Number(transaction.quantity) || 0),
    }));

  if (currentPrice > 0) {
    const now = Date.now();
    const latest = ordered.at(-1);
    if (!latest || now > latest.timestamp) {
      ordered.push({
        timestamp: now,
        price: currentPrice,
        quantity: latest?.quantity ?? 0,
      });
    }
  }

  return ordered;
}

function filterObservationsByRange(observations: TradeObservation[], range: TradeRange) {
  if (!observations.length || range === "ALL") {
    return observations;
  }

  const now = observations.at(-1)?.timestamp ?? Date.now();
  const cutoff =
    range === "1D"
      ? now - 24 * 60 * 60 * 1000
      : range === "1W"
        ? now - 7 * 24 * 60 * 60 * 1000
        : range === "1M"
          ? now - 30 * 24 * 60 * 60 * 1000
          : new Date(new Date(now).getFullYear(), 0, 1).getTime();

  const filtered = observations.filter((point) => point.timestamp >= cutoff);
  return filtered.length >= 2 ? filtered : observations.slice(-Math.min(observations.length, 16));
}

function bucketObservations(observations: TradeObservation[], range: TradeRange): TradeCandle[] {
  const buckets = new Map<number, TradeObservation[]>();

  observations.forEach((observation) => {
    const bucketTime = getBucketTimestamp(observation.timestamp, range);
    const list = buckets.get(bucketTime) ?? [];
    list.push(observation);
    buckets.set(bucketTime, list);
  });

  return Array.from(buckets.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([time, items]) => {
      const open = items[0]?.price ?? 0;
      const close = items[items.length - 1]?.price ?? open;
      const prices = items.map((item) => item.price);
      return {
        time: Math.floor(time / 1000) as UTCTimestamp,
        open,
        high: Math.max(...prices),
        low: Math.min(...prices),
        close,
        volume: items.reduce((total, item) => total + item.quantity, 0),
      };
    });
}

function getBucketTimestamp(timestamp: number, range: TradeRange) {
  const date = new Date(timestamp);

  if (range === "1D") {
    date.setMinutes(0, 0, 0);
  } else if (range === "1W" || range === "1M") {
    date.setHours(0, 0, 0, 0);
  } else {
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
  }

  return date.getTime();
}

function fromChartTime(value: Time) {
  if (typeof value === "number") {
    return new Date(value * 1000);
  }

  if (typeof value === "string") {
    return new Date(`${value}T00:00:00Z`);
  }

  return new Date(`${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}T00:00:00Z`);
}

function formatTooltipDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toDateTimeLocal(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function getAssetDisplayName(symbol: string) {
  const names: Record<string, string> = {
    BTC: "Bitcoin",
    ETH: "Ethereum",
    SOL: "Solana",
    BNB: "BNB",
    XRP: "XRP",
    USDT: "Tether",
    USDC: "USD Coin",
    DOGE: "Dogecoin",
    PEPE: "Pepe",
    HYPE: "Hyperliquid",
    AAPL: "Apple Inc.",
    MSFT: "Microsoft",
    GOOGL: "Alphabet",
    NVDA: "NVIDIA Corp",
    AMZN: "Amazon",
    TSLA: "Tesla",
    SPY: "SPDR S&P 500 ETF",
    QQQ: "Invesco QQQ Trust",
  };

  return names[symbol.toUpperCase()] ?? symbol.toUpperCase();
}

function WorkspaceStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <div className="rounded-[0.9rem] bg-[#0f1217] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#74829a]">{label}</p>
      <p className={`mt-2 text-[1rem] font-semibold ${tone === "positive" ? "text-[#16c784]" : tone === "negative" ? "text-[#ff5b6e]" : "text-white"}`}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-[0.95rem] bg-[#0c1015] px-4 py-3 text-[0.84rem] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
      <span className="text-[#7f8aa3]">{label}</span>
      <span className="max-w-[60%] truncate text-right font-semibold text-white">{value}</span>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-[#7f8aa3]">{label}</span>
      {children}
      {error ? <span className="block text-[0.76rem] text-[#ff9aa8]">{error}</span> : null}
    </label>
  );
}

function ModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`min-w-[120px] rounded-[0.78rem] px-4 py-2.5 text-[0.86rem] font-semibold transition ${
        active ? "bg-[#16c784] text-[#08110d]" : "text-[#a1aec2] hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function AssetOrb({ logoUrl, symbol }: { logoUrl: string | null; symbol: string }) {
  const [failed, setFailed] = useState(false);
  const initials = symbol.slice(0, 2).toUpperCase();
  const palette = pickAssetPalette(symbol);

  if (logoUrl && !failed) {
    return (
      <img
        alt={symbol}
        className="h-14 w-14 rounded-full bg-[#0d1015] object-cover shadow-[0_20px_40px_rgba(0,0,0,0.28)]"
        onError={() => setFailed(true)}
        src={logoUrl}
      />
    );
  }

  return (
    <span
      className="flex h-14 w-14 items-center justify-center rounded-full text-[0.92rem] font-bold shadow-[0_20px_40px_rgba(0,0,0,0.28)]"
      style={{ background: `radial-gradient(circle at 30% 30%, ${palette.highlight}, ${palette.base})`, color: palette.text }}
    >
      {initials}
    </span>
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
