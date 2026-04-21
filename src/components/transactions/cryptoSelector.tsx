"use client";

import { useEffect, useMemo, useState } from "react";

export type Crypto = {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  currentPrice?: number;
  marketCapRank?: number;
};

type CryptoSelectorProps = {
  value: string | null;
  onChange: (crypto: Crypto) => void;
};

type CoinGeckoMarketCoin = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price?: number;
  market_cap_rank?: number;
};

const CACHE_KEY = "coingecko-crypto-markets-top500-v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const INITIAL_VISIBLE_COUNT = 60;

export function CryptoSelector({ onChange, value }: CryptoSelectorProps) {
  const [query, setQuery] = useState("");
  const [cryptos, setCryptos] = useState<Crypto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, true>>({});

  useEffect(() => {
    let active = true;

    const cached = readCache();
    if (cached.length) {
      setCryptos(cached);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    async function loadCryptos() {
      try {
        const [pageOne, pageTwo] = await Promise.all([
          fetchMarketsPage(1),
          fetchMarketsPage(2),
        ]);

        if (!active) return;

        const nextCryptos = [...pageOne, ...pageTwo]
          .filter((crypto, index, source) => source.findIndex((item) => item.id === crypto.id) === index)
          .sort((left, right) => {
            const leftRank = left.marketCapRank ?? Number.MAX_SAFE_INTEGER;
            const rightRank = right.marketCapRank ?? Number.MAX_SAFE_INTEGER;
            return leftRank - rightRank;
          })
          .slice(0, 500);

        setCryptos(nextCryptos);
        writeCache(nextCryptos);
        setError(null);
      } catch (caughtError) {
        if (!active) return;
        if (!cached.length) setError("No fue posible cargar las criptomonedas en este momento.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCryptos();

    return () => {
      active = false;
    };
  }, []);

  const filteredCryptos = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const source = normalized
      ? cryptos.filter(
          (crypto) =>
            crypto.name.toLowerCase().includes(normalized) ||
            crypto.symbol.toLowerCase().includes(normalized),
        )
      : cryptos;

    return source.slice(0, INITIAL_VISIBLE_COUNT);
  }, [cryptos, query]);

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="sr-only">Search coin</span>
        <div className="flex items-center gap-3 rounded-[0.85rem] border border-[#2c3444] bg-[#171c24] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <span className="text-sm text-[#6f7a8f]">⌕</span>
          <input
            autoFocus
            className="w-full bg-transparent text-[0.92rem] text-white outline-none placeholder:text-[#6f7a8f]"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre o símbolo"
            type="search"
            value={query}
          />
        </div>
      </label>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center px-1 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f]">
        <span>Activo</span>
        <span>Mercado</span>
      </div>

      <div className="max-h-[23rem] overflow-y-auto rounded-[1rem] border border-[#1c2330] bg-[linear-gradient(180deg,rgba(22,27,35,0.94),rgba(16,20,28,0.98))] pr-1">
        {loading ? <p className="px-4 py-6 text-sm text-[#6f7a8f]">Cargando monedas...</p> : null}
        {!loading && error ? <p className="px-4 py-6 text-sm text-rose-400">{error}</p> : null}
        {!loading && !error && !filteredCryptos.length ? (
          <p className="px-4 py-6 text-sm text-[#6f7a8f]">No se encontraron monedas para esa búsqueda.</p>
        ) : null}

        <div className="space-y-1 p-2">
          {filteredCryptos.map((crypto) => {
            const isSelected = normalizeSearchValue(value) === normalizeSearchValue(crypto.name);
            const imageSrc = failedImages[crypto.id]
              ? null
              : crypto.image || `https://assets.coingecko.com/coins/images/1/small/${crypto.id}.png`;

            return (
              <button
                className={isSelected
                  ? "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[0.9rem] border border-[#26354f] bg-[#202734] px-3 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition"
                  : "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[0.9rem] border border-transparent px-3 py-3 text-left transition hover:border-[#232b3a] hover:bg-[#1a202a]"}
                key={crypto.id}
                onClick={() => onChange(crypto)}
                type="button"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {imageSrc ? (
                    <img
                      alt={crypto.name}
                      className="h-8 w-8 rounded-full bg-[#0f131b] object-cover"
                      loading="lazy"
                      onError={() =>
                        setFailedImages((current) => ({
                          ...current,
                          [crypto.id]: true,
                        }))
                      }
                      src={imageSrc}
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0f131b] text-xs font-semibold text-white">
                      {crypto.symbol.slice(0, 1).toUpperCase()}
                    </span>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      <span className="truncate text-[0.94rem] font-medium tracking-[-0.02em] text-white">
                        {crypto.name}
                      </span>
                      <span className="text-[0.84rem] text-[#7f8aa3]">
                        {crypto.symbol.toUpperCase()}
                      </span>
                    </div>
                    {crypto.marketCapRank ? (
                      <p className="mt-0.5 text-[0.73rem] text-[#6f7a8f]">Rank #{crypto.marketCapRank}</p>
                    ) : null}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[0.85rem] font-medium text-white">
                    {formatMarketPrice(crypto.currentPrice)}
                  </p>
                  <p className="mt-0.5 text-[0.73rem] text-[#6f7a8f]">USD</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

async function fetchMarketsPage(page: number) {
  const params = new URLSearchParams({
    vs_currency: "usd",
    order: "market_cap_desc",
    per_page: "250",
    page: page.toString(),
    sparkline: "false",
    price_change_percentage: "1h",
  });

  const response = await fetch(`/api/coingecko/markets?${params.toString()}`, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`CoinGecko request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as CoinGeckoMarketCoin[];

  return payload.map((coin) => ({
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    image: coin.image ?? null,
    currentPrice: coin.current_price,
    marketCapRank: coin.market_cap_rank,
  }));
}

function readCache() {
  if (typeof window === "undefined") return [] as Crypto[];

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [] as Crypto[];

    const parsed = JSON.parse(raw) as { timestamp?: number; items?: Crypto[] };
    if (!parsed.timestamp || !parsed.items?.length) return [] as Crypto[];
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return [] as Crypto[];

    return parsed.items;
  } catch {
    return [] as Crypto[];
  }
}

function writeCache(items: Crypto[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        items,
      }),
    );
  } catch {
    // Ignore storage failures and keep the selector functional.
  }
}

function formatMarketPrice(value?: number) {
  if (!value || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value >= 100 ? 0 : 2,
    maximumFractionDigits: value >= 100 ? 0 : 4,
  }).format(value);
}

function normalizeSearchValue(value?: string | null) {
  return value?.trim()?.toLowerCase() ?? "";
}
