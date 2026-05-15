"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AddTransactionModal } from "@/components/transactions/add-transaction-modal";
import { Modal } from "@/components/ui/modal";
import type { AssetOption } from "@/features/assets/types/asset.types";
import {
  getAssetLogoFromRegistry,
  readAssetLogoRegistry,
  type AssetLogoRegistry,
} from "@/features/assets/lib/asset-logo-registry";
import {
  fetchCoinGeckoCryptoLogoMap,
  readCoinGeckoCryptoLogoMap,
} from "@/features/assets/lib/coingecko-crypto-logos";
import {
  getCryptoMarketFeed,
  getGlobalMarketOverview,
  getTrendingMarketAssets,
} from "@/features/marketdata/api/get-crypto-market-feed";
import {
  getEquityMarketFeed,
  type EquityMarketSeed,
} from "@/features/marketdata/api/get-equity-market-feed";
import type { MarketRow, TrendingMarketAsset } from "@/features/marketdata/types/market.types";
import { getPortfolio } from "@/features/portfolio/api/get-portfolio";
import type { PortfolioEntry } from "@/features/portfolio/types/portfolio.types";
import { getUserTransactions } from "@/features/transactions/api/get-transactions";
import type { TransactionResponse } from "@/features/transactions/types/transaction.types";
import { normalizeAssetType } from "@/lib/utils/asset";
import { formatMarketPrice } from "@/lib/utils/format";

type MarketTab = "CRYPTO" | "STOCK" | "ETF" | "WATCHLIST";

type RecentAsset = {
  id: string;
  name: string;
  symbol: string;
  when: string;
};

type TrendingPreview = {
  id: string;
  name: string;
  symbol: string;
  price: number | null;
};

type TableBodyArgs = {
  rows: MarketRow[];
  isTableLoading: boolean;
  tableError: string | null;
  watchlist: string[];
  logoRegistry: AssetLogoRegistry;
  cryptoLogoMap: Record<string, string>;
  onToggleWatchlist: (rowId: string) => void;
  onOpenChart: (row: MarketRow) => void;
  onAddAsset: (row: MarketRow) => void;
};

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => void;
    };
  }
}

const WATCHLIST_STORAGE_KEY = "tracker-market-watchlist";
const MARKET_CARD_CLASS =
  "rounded-[1.35rem] bg-[#111317] shadow-[0_24px_60px_rgba(0,0,0,0.28)] ring-1 ring-[#191d24]/90";
const TRADING_VIEW_SCRIPT_URL = "https://s3.tradingview.com/tv.js";

const CURATED_STOCKS: EquityMarketSeed[] = [
  { symbol: "AAPL", name: "Apple Inc.", assetType: "STOCK", tvSymbol: "NASDAQ:AAPL" },
  { symbol: "MSFT", name: "Microsoft Corporation", assetType: "STOCK", tvSymbol: "NASDAQ:MSFT" },
  { symbol: "GOOGL", name: "Alphabet Inc.", assetType: "STOCK", tvSymbol: "NASDAQ:GOOGL" },
  { symbol: "NVDA", name: "NVIDIA Corp", assetType: "STOCK", tvSymbol: "NASDAQ:NVDA" },
  { symbol: "AMZN", name: "Amazon.com Inc.", assetType: "STOCK", tvSymbol: "NASDAQ:AMZN" },
  { symbol: "TSLA", name: "Tesla Inc.", assetType: "STOCK", tvSymbol: "NASDAQ:TSLA" },
];

const CURATED_ETFS: EquityMarketSeed[] = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF", assetType: "ETF", tvSymbol: "AMEX:SPY" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", assetType: "ETF", tvSymbol: "NASDAQ:QQQ" },
];

const KNOWN_ASSET_NAMES: Record<string, string> = {
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
  MSFT: "Microsoft Corporation",
  GOOGL: "Alphabet Inc.",
  NVDA: "NVIDIA Corp",
  AMZN: "Amazon.com Inc.",
  TSLA: "Tesla Inc.",
  SPY: "SPDR S&P 500 ETF",
  QQQ: "Invesco QQQ Trust",
};

let tradingViewScriptPromise: Promise<void> | null = null;
const EMPTY_MARKET_ROWS: MarketRow[] = [];

export function MarketsPage() {
  const [activeTab, setActiveTab] = useState<MarketTab>("CRYPTO");
  const [selectedChartAsset, setSelectedChartAsset] = useState<MarketRow | null>(null);
  const [addAsset, setAddAsset] = useState<AssetOption | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [logoRegistry, setLogoRegistry] = useState<AssetLogoRegistry>({});
  const [cryptoLogoMap, setCryptoLogoMap] = useState<Record<string, string>>({});

  const portfolioQuery = useQuery({
    queryKey: ["markets", "portfolio"],
    queryFn: () => getPortfolio(),
    staleTime: 60_000,
  });

  const transactionsQuery = useQuery({
    queryKey: ["markets", "transactions"],
    queryFn: () => getUserTransactions(),
    staleTime: 60_000,
  });

  const cryptoQuery = useQuery({
    queryKey: ["markets", "crypto-feed"],
    queryFn: () => getCryptoMarketFeed({ page: 1, perPage: 24 }),
    staleTime: 120_000,
    retry: false,
  });

  const globalQuery = useQuery({
    queryKey: ["markets", "global-overview"],
    queryFn: () => getGlobalMarketOverview(),
    staleTime: 300_000,
    retry: false,
  });

  const trendingQuery = useQuery({
    queryKey: ["markets", "trending"],
    queryFn: () => getTrendingMarketAssets(),
    staleTime: 300_000,
    retry: false,
  });

  useEffect(() => {
    setLogoRegistry(readAssetLogoRegistry());
    setWatchlist(readWatchlist());

    const cachedCryptoLogos = readCoinGeckoCryptoLogoMap();
    if (Object.keys(cachedCryptoLogos).length) {
      setCryptoLogoMap(cachedCryptoLogos);
    }

    let active = true;
    fetchCoinGeckoCryptoLogoMap()
      .then((map) => {
        if (active && Object.keys(map).length) {
          setCryptoLogoMap(map);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const stockSeeds = useMemo(
    () => buildEquitySeeds("STOCK", portfolioQuery.data ?? [], transactionsQuery.data ?? [], CURATED_STOCKS),
    [portfolioQuery.data, transactionsQuery.data],
  );

  const etfSeeds = useMemo(
    () => buildEquitySeeds("ETF", portfolioQuery.data ?? [], transactionsQuery.data ?? [], CURATED_ETFS),
    [portfolioQuery.data, transactionsQuery.data],
  );

  const stockQuery = useQuery({
    queryKey: ["markets", "stocks", stockSeeds.map((seed) => seed.symbol).join("|")],
    queryFn: () => getEquityMarketFeed(stockSeeds),
    enabled: stockSeeds.length > 0,
    staleTime: 120_000,
    retry: false,
  });

  const etfQuery = useQuery({
    queryKey: ["markets", "etfs", etfSeeds.map((seed) => seed.symbol).join("|")],
    queryFn: () => getEquityMarketFeed(etfSeeds),
    enabled: etfSeeds.length > 0,
    staleTime: 120_000,
    retry: false,
  });

  const cryptoRows = cryptoQuery.data ?? EMPTY_MARKET_ROWS;
  const stockRows = stockQuery.data ?? EMPTY_MARKET_ROWS;
  const etfRows = etfQuery.data ?? EMPTY_MARKET_ROWS;

  const allRows = useMemo(() => [...cryptoRows, ...stockRows, ...etfRows], [cryptoRows, etfRows, stockRows]);
  const rowsBySymbol = useMemo(() => {
    const map = new Map<string, MarketRow>();
    allRows.forEach((row) => {
      map.set(`${row.assetType}:${row.symbol}`, row);
    });
    return map;
  }, [allRows]);

  const visibleRows = useMemo(() => {
    if (activeTab === "CRYPTO") return cryptoRows;
    if (activeTab === "STOCK") return stockRows;
    if (activeTab === "ETF") return etfRows;
    return allRows.filter((row) => watchlist.includes(row.id));
  }, [activeTab, allRows, cryptoRows, etfRows, stockRows, watchlist]);

  const gainers24h = useMemo(
    () =>
      [...cryptoRows]
        .filter((row) => row.change24h !== null)
        .sort((left, right) => (right.change24h ?? -Infinity) - (left.change24h ?? -Infinity))
        .slice(0, 3),
    [cryptoRows],
  );

  const trendingRows = useMemo(
    () => buildTrendingRows(trendingQuery.data ?? [], rowsBySymbol).slice(0, 3),
    [rowsBySymbol, trendingQuery.data],
  );

  const recentAssets = useMemo(
    () => buildRecentAssets(transactionsQuery.data ?? [], rowsBySymbol).slice(0, 3),
    [rowsBySymbol, transactionsQuery.data],
  );

  const isTableLoading =
    cryptoQuery.isPending ||
    portfolioQuery.isPending ||
    transactionsQuery.isPending ||
    stockQuery.isPending ||
    etfQuery.isPending;

  const tableError =
    (cryptoQuery.error as Error | null)?.message ??
    (stockQuery.error as Error | null)?.message ??
    (etfQuery.error as Error | null)?.message ??
    null;

  function handleToggleWatchlist(rowId: string) {
    setWatchlist((current) => {
      const next = toggleWatchlist(current, rowId);
      writeWatchlist(next);
      return next;
    });
  }

  return (
    <main className="space-y-6">
      <section className="flex flex-wrap items-center gap-3 border-b border-[#181b21] pb-4 text-xs font-medium text-[#7c8799]">
        <MarketMetricBadge active label="Global Market:" />
        <MarketStatChip
          change={globalQuery.data?.marketCapChangePercentage24hUsd ?? null}
          label="Market Cap"
          value={formatCompactUsd(globalQuery.data?.marketCapUsd)}
        />
        <MarketStatChip
          change={globalQuery.data?.volume24hChangePercentage ?? null}
          label="Volumen (24h)"
          value={formatCompactUsd(globalQuery.data?.volume24hUsd)}
        />
        <MarketStatChip
          label="Dominancia BTC"
          value={formatPercentValue(globalQuery.data?.btcDominance, 1)}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <MarketInfoCard icon={<TrendUpMiniIcon className="h-4 w-4 text-[#17c784]" />} title="Mayores Ganancias (24h)">
          {gainers24h.length ? (
            gainers24h.map((asset, index) => (
              <CardRow
                key={asset.id}
                leading={`${index + 1}`}
                subtitle={asset.symbol}
                title={asset.name}
                trailing={renderChange(asset.change24h)}
              />
            ))
          ) : (
            <EmptyCardMessage message="Sin datos de variacion 24h disponibles." />
          )}
        </MarketInfoCard>

        <MarketInfoCard icon={<FlameMiniIcon className="h-4 w-4 text-[#f97316]" />} title="Tendencia en Busqueda">
          {trendingRows.length ? (
            trendingRows.map((asset, index) => (
              <CardRow
                key={`${asset.symbol}-${index}`}
                leading={`${index + 1}`}
                subtitle={asset.symbol}
                title={asset.name}
                trailing={<span className="tabular-nums text-[#f3f6fb]">{formatMarketPrice(asset.price)}</span>}
              />
            ))
          ) : (
            <EmptyCardMessage message="No se pudo construir la tendencia de busqueda." />
          )}
        </MarketInfoCard>

        <MarketInfoCard icon={<ClockMiniIcon className="h-4 w-4 text-[#60a5fa]" />} title="Anadidos Recientemente">
          {recentAssets.length ? (
            recentAssets.map((asset) => (
              <CardRow
                key={asset.id}
                leading="-"
                subtitle={asset.symbol}
                title={asset.name}
                trailing={
                  <span className="rounded-[0.45rem] bg-[#171b22] px-2 py-1 text-[0.72rem] font-medium text-[#9aa8bf]">
                    {asset.when}
                  </span>
                }
              />
            ))
          ) : (
            <EmptyCardMessage message="Tus activos recientes apareceran aqui." />
          )}
        </MarketInfoCard>
      </section>

      <section className={`${MARKET_CARD_CLASS} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#181b21] bg-[#0f1217]/85 px-5 py-4">
          <div className="flex items-center gap-2 rounded-[0.95rem] bg-[#0d1015] p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
            <MarketTabButton active={activeTab === "CRYPTO"} label="Criptomonedas" onClick={() => setActiveTab("CRYPTO")} />
            <MarketTabButton active={activeTab === "STOCK"} label="Acciones" onClick={() => setActiveTab("STOCK")} />
            <MarketTabButton active={activeTab === "ETF"} label="ETFs" onClick={() => setActiveTab("ETF")} />
            <MarketTabButton
              active={activeTab === "WATCHLIST"}
              label={`Watchlist${watchlist.length ? ` (${watchlist.length})` : ""}`}
              onClick={() => setActiveTab("WATCHLIST")}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-[0.8rem] bg-[#11151b] px-3.5 py-2 text-[0.8rem] font-semibold text-[#d8e0ec] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition hover:bg-[#161b23]"
              type="button"
            >
              <FilterMiniIcon className="h-3.5 w-3.5" />
              Filtros
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-[0.8rem] bg-[#11151b] px-3.5 py-2 text-[0.8rem] font-semibold text-[#d8e0ec] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition hover:bg-[#161b23]"
              type="button"
            >
              Personalizar
              <ChevronDownMiniIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#181b21] text-[0.74rem] font-semibold uppercase tracking-[0.08em] text-[#6f7a8f]">
                <th className="w-14 px-5 py-4 text-center">#</th>
                <th className="px-5 py-4">Nombre</th>
                <th className="px-5 py-4 text-right">Precio</th>
                <th className="px-5 py-4 text-right">1h %</th>
                <th className="px-5 py-4 text-right">24h %</th>
                <th className="px-5 py-4 text-right">7d %</th>
                <th className="px-5 py-4 text-right">Market Cap</th>
                <th className="px-5 py-4 text-right">Volumen (24h)</th>
                <th className="px-5 py-4 text-center">Ultimos 7 dias</th>
                <th className="w-28 px-5 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#181b21]">
              {renderTableBody({
                rows: visibleRows,
                isTableLoading,
                tableError,
                watchlist,
                logoRegistry,
                cryptoLogoMap,
                onToggleWatchlist: handleToggleWatchlist,
                onOpenChart: setSelectedChartAsset,
                onAddAsset: (row) => setAddAsset(toAssetOption(row)),
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#181b21] px-5 py-4 text-xs text-[#7c8799]">
          <span>
            Mostrando 1 - {visibleRows.length} de {visibleRows.length} activos
          </span>
          <div className="flex items-center gap-2">
            <button className="px-2 py-1 transition hover:text-white" type="button">
              Ant
            </button>
            <span className="rounded-[0.45rem] bg-[#171b22] px-2.5 py-1 text-white">1</span>
            <button className="px-2 py-1 transition hover:text-white" type="button">
              Sig
            </button>
          </div>
        </div>
      </section>

      <AddTransactionModal
        initialAsset={addAsset}
        isOpen={Boolean(addAsset)}
        onClose={() => setAddAsset(null)}
        onCreated={async () => {
          window.dispatchEvent(new Event("portfolio:refresh"));
          await Promise.allSettled([
            portfolioQuery.refetch(),
            transactionsQuery.refetch(),
            stockQuery.refetch(),
            etfQuery.refetch(),
          ]);
        }}
        portfolioAssetType={addAsset?.assetType}
        suggestedAssets={addAsset ? [addAsset] : []}
      />

      <TradingViewModal asset={selectedChartAsset} onClose={() => setSelectedChartAsset(null)} />
    </main>
  );
}

function renderTableBody({
  rows,
  isTableLoading,
  tableError,
  watchlist,
  logoRegistry,
  cryptoLogoMap,
  onToggleWatchlist,
  onOpenChart,
  onAddAsset,
}: TableBodyArgs) {
  if (isTableLoading) {
    return (
      <tr>
        <td className="px-5 py-12 text-center text-[#7c8799]" colSpan={10}>
          Cargando mercados...
        </td>
      </tr>
    );
  }

  if (tableError) {
    return (
      <tr>
        <td className="px-5 py-12 text-center text-[#ff7e8a]" colSpan={10}>
          {tableError}
        </td>
      </tr>
    );
  }

  if (!rows.length) {
    return (
      <tr>
        <td className="px-5 py-12 text-center text-[#7c8799]" colSpan={10}>
          No hay activos disponibles para esta vista.
        </td>
      </tr>
    );
  }

  return rows.map((row, index) => {
    const watchlisted = watchlist.includes(row.id);

    return (
      <tr className="group bg-transparent transition hover:bg-[#13171d]" key={row.id}>
        <td className="px-5 py-5 text-center align-middle">
          <div className="flex flex-col items-center gap-2">
            <span className="text-[0.92rem] font-medium text-[#9aa8bf]">{row.rank ?? index + 1}</span>
            <button
              aria-label={watchlisted ? "Remove from watchlist" : "Add to watchlist"}
              className={`transition ${watchlisted ? "text-[#f59e0b]" : "text-[#4b5565] hover:text-white"}`}
              onClick={() => onToggleWatchlist(row.id)}
              type="button"
            >
              <StarMiniIcon className="h-4 w-4" filled={watchlisted} />
            </button>
          </div>
        </td>
        <td className="px-5 py-5 align-middle">
          <AssetBadge cryptoLogoMap={cryptoLogoMap} logoRegistry={logoRegistry} row={row} />
        </td>
        <td className="px-5 py-5 text-right align-middle tabular-nums text-[1.02rem] font-semibold text-[#f4f7fb]">
          {formatMarketPrice(row.price)}
        </td>
        <td className="px-5 py-5 text-right align-middle">{renderChange(row.change1h)}</td>
        <td className="px-5 py-5 text-right align-middle">{renderChange(row.change24h)}</td>
        <td className="px-5 py-5 text-right align-middle">{renderChange(row.change7d)}</td>
        <td className="px-5 py-5 text-right align-middle tabular-nums text-[#cfd6e3]">
          {formatCompactUsd(row.marketCap)}
        </td>
        <td className="px-5 py-5 text-right align-middle tabular-nums text-[#cfd6e3]">
          {formatCompactUsd(row.volume24h)}
        </td>
        <td className="px-5 py-5 align-middle">
          <div className="mx-auto w-[120px]">
            <Sparkline change7d={row.change7d} data={row.sparkline} />
          </div>
        </td>
        <td className="px-5 py-5 align-middle">
          <div className="flex items-center justify-center gap-2">
            <button
              aria-label={`Open ${row.symbol} chart`}
              className="rounded-[0.72rem] bg-[#11151b] p-2.5 text-[#aab4c3] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition hover:bg-[#171c24] hover:text-white"
              onClick={() => onOpenChart(row)}
              type="button"
            >
              <ChartBarsMiniIcon className="h-4 w-4" />
            </button>
            <button
              aria-label={`Add ${row.symbol} transaction`}
              className="rounded-[0.72rem] bg-[#11151b] p-2.5 text-[#aab4c3] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition hover:bg-[#171c24] hover:text-white"
              onClick={() => onAddAsset(row)}
              type="button"
            >
              <PlusMiniIcon className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  });
}

function MarketMetricBadge({ active = false, label }: { active?: boolean; label: string }) {
  return (
    <span
      className={`rounded-[0.55rem] px-2 py-1 text-[0.74rem] font-semibold ${
        active ? "bg-[#112f24] text-[#7af1b2]" : "bg-[#11151b] text-[#d8e0ec]"
      }`}
    >
      {label}
    </span>
  );
}

function MarketStatChip({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change?: number | null;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-[0.75rem] bg-[#101318] px-3 py-2 text-[0.76rem] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
      <span>{label}:</span>
      <span className="font-semibold text-[#f3f6fb]">{value}</span>
      {change === undefined ? null : renderChange(change, "compact")}
    </div>
  );
}

function MarketInfoCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={MARKET_CARD_CLASS}>
      <div className="flex items-center gap-2 border-b border-[#181b21] px-5 py-4">
        {icon}
        <h3 className="text-[1rem] font-semibold text-[#f3f6fb]">{title}</h3>
      </div>
      <div className="divide-y divide-[#181b21]">{children}</div>
    </section>
  );
}

function CardRow({
  leading,
  title,
  subtitle,
  trailing,
}: {
  leading: ReactNode;
  title: string;
  subtitle: string;
  trailing: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4">
      <div className="flex min-w-0 items-center gap-4">
        <div className="w-4 shrink-0 text-sm font-medium text-[#8390a7]">{leading}</div>
        <div className="min-w-0">
          <p className="truncate text-[1rem] font-semibold text-[#f3f6fb]">{title}</p>
          <p className="truncate text-[0.83rem] text-[#7c8799]">{subtitle}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">{trailing}</div>
    </div>
  );
}

function EmptyCardMessage({ message }: { message: string }) {
  return <div className="px-5 py-8 text-sm text-[#7c8799]">{message}</div>;
}

function MarketTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-[0.78rem] px-4 py-2.5 text-[0.82rem] font-semibold transition ${
        active
          ? "bg-[#171c24] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
          : "text-[#8f99ab] hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function AssetBadge({
  row,
  logoRegistry,
  cryptoLogoMap,
}: {
  row: MarketRow;
  logoRegistry: AssetLogoRegistry;
  cryptoLogoMap: Record<string, string>;
}) {
  const logoUrl =
    row.logoUrl ??
    (row.assetType === "CRYPTO" ? cryptoLogoMap[row.symbol] ?? null : getAssetLogoFromRegistry(logoRegistry, row.symbol, row.assetType));

  const fallbackColor = pickPalette(row.symbol);

  return (
    <div className="flex items-center gap-4">
      <div
        className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
        style={{ backgroundColor: logoUrl ? "#0d1015" : fallbackColor }}
      >
        {logoUrl ? (
          <Image
            alt={row.symbol}
            className="h-8 w-8 rounded-full object-cover"
            height={32}
            src={logoUrl}
            unoptimized
            width={32}
          />
        ) : (
          <span className="text-sm font-bold text-white">{row.symbol.slice(0, 1)}</span>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[1rem] font-semibold text-[#f4f7fb]">{row.name}</span>
          {row.assetType === "STOCK" ? (
            <span className="rounded-[0.45rem] bg-[#171b22] px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[#b2bdd1]">
              STOCK
            </span>
          ) : null}
          <span className="rounded-[0.45rem] bg-[#171b22] px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[#8d9ab0]">
            {row.symbol}
          </span>
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data, change7d }: { data: number[]; change7d: number | null }) {
  if (!data.length) {
    return <div className="h-12 rounded-[0.75rem] bg-[#11151b]" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const color = (change7d ?? 0) >= 0 ? "#17c784" : "#ff4d67";

  const points = data
    .map((value, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 118;
      const y = 38 - ((value - min) / span) * 30;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="h-12 w-full" viewBox="0 0 118 42">
      <polyline
        fill="none"
        points={points}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function TradingViewModal({ asset, onClose }: { asset: MarketRow | null; onClose: () => void }) {
  if (!asset) return null;

  return (
    <Modal
      hideDefaultCloseButton
      onClose={onClose}
      overlayClassName="bg-[#05070b]/72 backdrop-blur-lg"
      panelClassName="max-w-[min(96vw,1200px)] rounded-[1.4rem] border-0 bg-[#0c1015] p-0 text-white shadow-[0_30px_100px_rgba(0,0,0,0.5)] ring-1 ring-[#1a212c]"
    >
      <div className="flex items-center justify-between border-b border-[#181d24] px-5 py-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#7c8799]">Mercados</p>
          <h3 className="mt-1 text-[1.15rem] font-semibold text-[#f4f7fb]">
            {asset.name} <span className="text-[#7c8799]">{asset.symbol}</span>
          </h3>
        </div>
        <button
          aria-label="Close TradingView modal"
          className="rounded-full p-2 text-[#8d9ab0] transition hover:bg-white/[0.04] hover:text-white"
          onClick={onClose}
          type="button"
        >
          <CloseMiniIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="h-[72vh] min-h-[520px]">
        <TradingViewWidget asset={asset} />
      </div>
    </Modal>
  );
}

function TradingViewWidget({ asset }: { asset: MarketRow }) {
  const widgetHostRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = widgetHostRef.current;

    async function mountWidget() {
      if (!host) return;

      setFailed(false);
      host.innerHTML = "";

      try {
        await loadTradingViewScript();
        if (!window.TradingView?.widget) {
          throw new Error("TradingView widget unavailable");
        }

        host.id = `tradingview_${asset.id.replace(/[^a-zA-Z0-9]/g, "_")}`;

        void new window.TradingView.widget({
          autosize: true,
          container_id: host.id,
          symbol: asset.tvSymbol,
          interval: "240",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "es",
          hide_top_toolbar: false,
          hide_legend: false,
          enable_publishing: false,
          allow_symbol_change: true,
          withdateranges: true,
          details: true,
          hotlist: true,
          studies: ["Volume@tv-basicstudies"],
        });
      } catch {
        setFailed(true);
      }
    }

    void mountWidget();

    return () => {
      if (host) {
        host.innerHTML = "";
      }
    };
  }, [asset]);

  if (failed) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[#8d9ab0]">
        No se pudo cargar el widget avanzado de TradingView para {asset.symbol}.
      </div>
    );
  }

  return <div className="h-full w-full bg-[#0b0f14]" ref={widgetHostRef} />;
}

function buildEquitySeeds(
  marketCategory: "STOCK" | "ETF",
  portfolioEntries: PortfolioEntry[],
  transactions: TransactionResponse[],
  curatedSeeds: EquityMarketSeed[],
) {
  const unique = new Map<string, EquityMarketSeed>();

  curatedSeeds.forEach((seed) => {
    unique.set(`${marketCategory}:${seed.symbol.toUpperCase()}`, {
      ...seed,
      symbol: seed.symbol.toUpperCase(),
    });
  });

  portfolioEntries.forEach((entry) => {
    const normalizedType = normalizeAssetType(entry.assetType);
    if (normalizedType !== marketCategory) return;

    const symbol = entry.assetSymbol.trim().toUpperCase();
    unique.set(`${marketCategory}:${symbol}`, {
      symbol,
      name: KNOWN_ASSET_NAMES[symbol] ?? symbol,
      assetType: marketCategory,
    });
  });

  transactions.forEach((transaction) => {
    const normalizedType = normalizeAssetType(transaction.assetType);
    if (normalizedType !== marketCategory) return;

    const symbol = transaction.assetSymbol.trim().toUpperCase();
    unique.set(`${marketCategory}:${symbol}`, {
      symbol,
      name: KNOWN_ASSET_NAMES[symbol] ?? symbol,
      assetType: marketCategory,
    });
  });

  return Array.from(unique.values());
}

function buildTrendingRows(trendingAssets: TrendingMarketAsset[], rowsBySymbol: Map<string, MarketRow>): TrendingPreview[] {
  return trendingAssets
    .map((asset) => {
      const marketRow = rowsBySymbol.get(`CRYPTO:${asset.symbol.toUpperCase()}`);

      return {
        id: asset.id,
        name: marketRow?.name ?? asset.name,
        symbol: asset.symbol.toUpperCase(),
        price: marketRow?.price ?? null,
      };
    })
    .filter((asset) => Boolean(asset.name));
}

function buildRecentAssets(transactions: TransactionResponse[], rowsBySymbol: Map<string, MarketRow>): RecentAsset[] {
  const sorted = [...transactions].sort(
    (left, right) => new Date(right.transactionDate).getTime() - new Date(left.transactionDate).getTime(),
  );
  const unique = new Map<string, RecentAsset>();

  sorted.forEach((transaction) => {
    const symbol = transaction.assetSymbol.trim().toUpperCase();
    const assetType = normalizeAssetType(transaction.assetType);
    const key = `${assetType}:${symbol}`;
    if (unique.has(key)) return;

    const row = rowsBySymbol.get(key);
    unique.set(key, {
      id: key,
      name: row?.name ?? KNOWN_ASSET_NAMES[symbol] ?? symbol,
      symbol,
      when: formatTimeAgo(transaction.transactionDate),
    });
  });

  return Array.from(unique.values());
}

function toAssetOption(row: MarketRow): AssetOption {
  return {
    assetId: row.assetId,
    symbol: row.symbol,
    name: row.name,
    assetType: row.assetType,
    logoUrl: row.logoUrl,
    supportedForTransactions: true,
    suggestedPrice: row.price,
  };
}

function readWatchlist() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeWatchlist(next: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
}

function toggleWatchlist(current: string[], rowId: string) {
  return current.includes(rowId) ? current.filter((value) => value !== rowId) : [...current, rowId];
}


function renderChange(value: number | null, variant: "default" | "compact" = "default") {
  if (value === null || !Number.isFinite(value)) {
    return <span className="font-medium text-[#6f7a8f]">--</span>;
  }

  const positive = value >= 0;
  const textClass = positive ? "text-[#17c784]" : "text-[#ff4d67]";
  const sizeClass = variant === "compact" ? "text-[0.72rem]" : "text-[0.95rem]";

  return (
    <span className={`inline-flex items-center justify-end gap-1 font-semibold ${textClass} ${sizeClass}`}>
      {positive ? <ArrowUpMiniIcon className="h-3.5 w-3.5" /> : <ArrowDownMiniIcon className="h-3.5 w-3.5" />}
      {formatPercentValue(value)}
    </span>
  );
}

function formatCompactUsd(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}


function formatPercentValue(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  return `${value >= 0 ? "" : "-"}${Math.abs(value).toFixed(digits)}%`;
}

function formatTimeAgo(isoDate: string) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));

  if (diffHours < 24) {
    return `Hace ${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return "Ayer";
  }

  return `Hace ${diffDays}d`;
}

function pickPalette(symbol: string) {
  const palette = ["#0e7a4f", "#1d4ed8", "#7c3aed", "#ea580c", "#0891b2", "#be185d", "#65a30d"];
  const sum = symbol.split("").reduce((total, character) => total + character.charCodeAt(0), 0);
  return palette[sum % palette.length];
}

async function loadTradingViewScript() {
  if (typeof window === "undefined") return;
  if (window.TradingView?.widget) return;

  if (!tradingViewScriptPromise) {
    tradingViewScriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${TRADING_VIEW_SCRIPT_URL}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("TradingView script failed")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = TRADING_VIEW_SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("TradingView script failed"));
      document.body.appendChild(script);
    }).catch((error) => {
      tradingViewScriptPromise = null;
      throw error;
    });
  }

  await tradingViewScriptPromise;
}

function TrendUpMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M4 16.5L9 11.5L13 15.5L20 8.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M15 8.5H20V13.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function FlameMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M13.5 2.8c1.5 4.2-1.2 5.4-.9 7.7.2 1.4 1.4 2.2 2.7 2.2 2.2 0 3.7-1.9 3.7-4.5 2.2 2.1 3.1 4.5 3.1 6.8A8.1 8.1 0 1 1 5.9 11c0-2.9 1.4-5.4 3.8-7.2-.2 3.2 1.4 4.9 3.8 4.9 1.3 0 2.2-.9 2.2-2.3 0-1.3-.8-2.4-2.2-3.6Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
    </svg>
  );
}

function ClockMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5V12L15.5 14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
    </svg>
  );
}

function FilterMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M4 6H20" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M7 12H17" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M10 18H14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

function ChevronDownMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M7 10L12 15L17 10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function StarMiniIcon({ className, filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24">
      <path
        d="M12 3.75L14.55 8.92L20.25 9.74L16.13 13.76L17.1 19.43L12 16.75L6.9 19.43L7.87 13.76L3.75 9.74L9.45 8.92L12 3.75Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function ChartBarsMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M6 18V10" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M12 18V6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M18 18V13" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function PlusMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M12 5V19" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M5 12H19" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function ArrowUpMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M6 14L12 8L18 14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function ArrowDownMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M6 10L12 16L18 10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function CloseMiniIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <path d="M6 6L18 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M18 6L6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}
