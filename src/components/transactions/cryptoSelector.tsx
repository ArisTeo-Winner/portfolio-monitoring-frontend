"use client";

import Image from "next/image";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { formatMarketPrice } from "@/lib/utils/format";

export type Crypto = {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  currentPrice?: number;
  marketCapRank?: number;
};

type CryptoSelectorProps = {
  heading?: ReactNode;
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

// Not shared with coingecko-crypto-logos.ts: that cache stores a reduced
// {id, symbol, image} shape, which rendered here as nameless, priceless rows.
const CACHE_KEY = "coingecko-crypto-selector-markets-v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const INITIAL_VISIBLE_COUNT = 60;

export function CryptoSelector({ heading, onChange, value }: CryptoSelectorProps) {
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
      } catch {
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

  const selectedName = normalizeSearchValue(value);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pb-3 md:px-7 md:pb-6 md:pt-6">
        {heading}
        <div className="mt-0 rounded-[0.875rem] border border-[#252c36] bg-[#14191f] px-3 py-2 md:mt-5 md:rounded-[0.85rem] md:px-4 md:py-3">
          <div className="flex items-center gap-3">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[#6f7a8f]" />
            <input
              aria-label="Buscar moneda"
              autoFocus
              className="w-full bg-transparent text-[0.875rem] text-white outline-none placeholder:text-[#6f7a8f] md:text-[0.92rem]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o símbolo"
              value={query}
            />
            {query ? <button className="text-[0.8125rem] font-medium text-[#7f8aa3] transition hover:text-white md:text-sm" onClick={() => setQuery("")} type="button">Limpiar</button> : null}
          </div>
        </div>
      </div>

      <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-4 md:px-7 md:pb-7">
        <div className="grid grid-cols-[1fr_auto] gap-4 px-2 pb-2 text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] md:text-[0.72rem]">
          <span>Activo</span>
          <span>Precio</span>
        </div>

        {loading ? <p className="px-2 py-4 text-[0.8125rem] text-[#6f7a8f] md:py-5 md:text-sm">Cargando monedas...</p> : null}
        {!loading && error ? <p className="px-2 py-4 text-[0.8125rem] text-rose-400 md:py-5 md:text-sm">{error}</p> : null}
        {!loading && !error && !filteredCryptos.length ? (
          <p className="px-2 py-4 text-[0.8125rem] text-[#6f7a8f] md:py-5 md:text-sm">No se encontraron monedas para esa búsqueda.</p>
        ) : null}

        <div className="space-y-1 md:space-y-1.5">
          {filteredCryptos.map((crypto) => {
            const isSelected = Boolean(selectedName) && selectedName === normalizeSearchValue(crypto.name);
            const imageSrc = failedImages[crypto.id]
              ? null
              : crypto.image || `https://assets.coingecko.com/coins/images/1/small/${crypto.id}.png`;

            return (
              <button
                className={`grid h-14 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[0.625rem] border px-3 py-2 text-left transition md:h-auto md:rounded-[0.9rem] md:py-3 ${
                  isSelected
                    ? "border-[#2a313b] bg-[#1a2028]"
                    : "border-transparent bg-[#101418] hover:border-[#232931] hover:bg-[#14191f]"
                }`}
                key={crypto.id}
                onClick={() => onChange(crypto)}
                type="button"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {imageSrc ? (
                    <Image
                      alt={buildCryptoAlt(crypto)}
                      className="h-7 w-7 rounded-full bg-[#0f131b] object-cover md:h-8 md:w-8"
                      height={32}
                      loading="lazy"
                      onError={() =>
                        setFailedImages((current) => ({
                          ...current,
                          [crypto.id]: true,
                        }))
                      }
                      src={imageSrc}
                      unoptimized
                      width={32}
                    />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0f131b] text-[0.6875rem] font-semibold text-white md:h-8 md:w-8 md:text-xs">
                      {crypto.symbol.slice(0, 1).toUpperCase()}
                    </span>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 md:gap-x-2.5">
                      <span className="truncate text-[0.875rem] font-medium text-white md:text-[0.92rem]">{crypto.name}</span>
                      <span className="text-[0.6875rem] text-[#7f8aa3] md:text-[0.8rem]">{crypto.symbol.toUpperCase()}</span>
                    </div>
                    {crypto.marketCapRank ? (
                      <p className="mt-0.5 truncate text-[0.6875rem] text-[#6f7a8f] md:text-[0.72rem]">Rank #{crypto.marketCapRank}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2 md:gap-2.5">
                  <div className="text-right">
                    <p className="text-[0.8125rem] font-medium text-white md:text-[0.85rem]">
                      {formatMarketPrice(crypto.currentPrice ?? null)}
                    </p>
                    <p className="mt-0.5 text-[0.6875rem] text-[#6f7a8f] md:text-[0.72rem]">USD</p>
                  </div>
                  <span aria-hidden="true" className="text-[1rem] leading-none text-[#7f8aa3] md:text-lg">&rsaquo;</span>
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

    // Drop entries without a name so a stale or foreign payload can't render blank rows.
    return parsed.items.filter(
      (item) => typeof item?.name === "string" && item.name.trim() !== "" && typeof item.symbol === "string",
    );
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


function normalizeSearchValue(value?: string | null) {
  return value?.trim()?.toLowerCase() ?? "";
}

function buildCryptoAlt(crypto: Crypto) {
  const name = crypto.name?.trim();
  const symbol = crypto.symbol?.trim().toUpperCase();

  if (name && symbol) {
    return `${name} (${symbol})`;
  }

  if (name) {
    return name;
  }

  if (symbol) {
    return `${symbol} logo`;
  }

  return "Crypto asset logo";
}
