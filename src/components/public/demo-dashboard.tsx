"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthDialog } from "@/components/auth/auth-dialog";
import {
  getCryptoMarketFeed,
  getGlobalMarketOverview,
  getTrendingMarketAssets,
} from "@/features/marketdata/api/get-crypto-market-feed";
import type {
  MarketOverviewStats,
  MarketRow,
  TrendingMarketAsset,
} from "@/features/marketdata/types/market.types";
import { useSearchParams } from "next/navigation";

type Mode = "login" | "register";
const EMPTY_MARKET_ROWS: MarketRow[] = [];
const EMPTY_TRENDING_ASSETS: TrendingMarketAsset[] = [];

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  OIDC_LOGIN_FAILED: "No fue posible completar el acceso con Google.",
  OAUTH2_PRINCIPAL_INVALID: "La sesión de Google no pudo vincularse a una cuenta válida.",
  OAUTH2_TOKEN_ISSUE_FAILED: "Google autenticó la cuenta, pero el backend no pudo emitir los tokens.",
};

const PARTNER_CHIPS = [
  "Binance",
  "Coinbase",
  "Bybit",
  "Interactive Brokers",
  "Bitget",
  "Kraken",
];

export function DemoDashboard({
  initialAuthMode = "register",
  openOnLoad = false,
}: {
  initialAuthMode?: Mode;
  openOnLoad?: boolean;
} = {}) {
  const searchParams = useSearchParams();
  const oauthError = searchParams?.get("oauth_error");
  const sessionExpired = searchParams?.get("session_expired");

  const oauthErrorMessage = oauthError
    ? (OAUTH_ERROR_MESSAGES[oauthError] ?? "No fue posible completar el acceso social.")
    : null;
  const sessionExpiredMessage = sessionExpired
    ? "Tu sesión expiró o ya no pudo renovarse. Inicia sesión de nuevo para continuar."
    : null;
  const authMessage = sessionExpiredMessage ?? oauthErrorMessage;

  const initialOpen = openOnLoad;

  const [authOpen, setAuthOpen] = useState(initialOpen);
  const [authMode, setAuthMode] = useState<Mode>(initialAuthMode);
  const [prefilledEmail, setPrefilledEmail] = useState("");

  useEffect(() => {
    if (!openOnLoad) {
      return;
    }

    setAuthOpen(true);
  }, [openOnLoad]);

  const tickerQuery = useQuery({
    queryKey: ["public-home", "ticker"],
    queryFn: () => getCryptoMarketFeed({ page: 1, perPage: 10 }),
    staleTime: 25_000,
    retry: false,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const cryptoQuery = useQuery({
    queryKey: ["public-home", "crypto"],
    queryFn: () => getCryptoMarketFeed({ page: 1, perPage: 12 }),
    staleTime: 120_000,
    retry: false,
  });

  const globalQuery = useQuery({
    queryKey: ["public-home", "global"],
    queryFn: () => getGlobalMarketOverview(),
    staleTime: 300_000,
    retry: false,
  });

  const trendingQuery = useQuery({
    queryKey: ["public-home", "trending"],
    queryFn: () => getTrendingMarketAssets(),
    staleTime: 300_000,
    retry: false,
  });

  const assets = cryptoQuery.data ?? EMPTY_MARKET_ROWS;
  const tickerAssets = tickerQuery.data ?? assets;
  const globalStats = globalQuery.data ?? EMPTY_GLOBAL_STATS;
  const trendingAssets = trendingQuery.data ?? EMPTY_TRENDING_ASSETS;

  const previewAssets = useMemo(() => assets.slice(0, 4), [assets]);
  const gainers = useMemo(
    () =>
      [...assets]
        .filter((asset) => asset.change24h !== null)
        .sort((left, right) => (right.change24h ?? -Infinity) - (left.change24h ?? -Infinity))
        .slice(0, 3),
    [assets],
  );
  const trending = useMemo(() => mapTrending(trendingAssets, assets).slice(0, 3), [assets, trendingAssets]);
  const compositeSeries = useMemo(() => buildCompositeSeries(previewAssets), [previewAssets]);
  const allocation = useMemo(() => buildAllocation(previewAssets), [previewAssets]);

  function openAuth(mode: Mode) {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  function handleRegistered(email: string) {
    setPrefilledEmail(email);
    setAuthMode("login");
  }

  return (
    <>
      <main className="min-h-screen bg-[#05070a] text-[#f3f6fb]">
        <TopTicker assets={tickerAssets} />

        <header className="sticky top-0 z-40 border-b border-[#0f141b] bg-[#05070a]/92 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-6">
            <Link className="flex items-center gap-3" href="/">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1fd68a] text-[#03120c] shadow-[0_12px_30px_rgba(31,214,138,0.18)]">
                <TriangleIcon className="h-5 w-5" />
              </div>
              <span className="text-[1.6rem] font-bold tracking-[-0.04em] text-white">TRACKER</span>
            </Link>

            <nav className="hidden items-center gap-8 text-sm font-medium text-[#9aa4b2] lg:flex">
              <a className="transition hover:text-white" href="#features">Características</a>
              <a className="transition hover:text-white" href="#integrations">Integraciones</a>
              <a className="transition hover:text-white" href="#community">Comunidad</a>
            </nav>

            <div className="flex items-center gap-3">
              <button
                className="flex items-center justify-center rounded-lg bg-[#19c37d] px-4 py-2 text-sm font-bold text-[#04120c] transition hover:bg-[#28d389] sm:hidden"
                data-testid="open-login-btn-mobile"
                onClick={() => openAuth("login")}
                suppressHydrationWarning
                type="button"
              >
                Iniciar sesión
              </button>
              <button
                className="hidden text-sm font-medium text-[#d0d7e2] transition hover:text-white sm:inline-flex"
                data-testid="open-login-btn-desktop"
                onClick={() => openAuth("login")}
                suppressHydrationWarning
                type="button"
              >
                Iniciar sesión
              </button>
              <button
                className="hidden items-center justify-center rounded-lg bg-[#19c37d] px-4 py-2 text-sm font-bold text-[#04120c] shadow-[0_18px_40px_rgba(25,195,125,0.22)] transition hover:bg-[#28d389] sm:flex"
                onClick={() => openAuth("register")}
                suppressHydrationWarning
                type="button"
              >
                Empieza gratis
              </button>
            </div>
          </div>
        </header>

        <section className="relative overflow-hidden pb-32 pt-24">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-[radial-gradient(circle_at_top,rgba(18,148,95,0.18),transparent_58%)]" />
          <div className="mx-auto max-w-[1440px] px-6">
            <div className="mx-auto max-w-[900px] text-center">
              {authMessage ? (
                <div className="mx-auto mb-8 flex max-w-[760px] items-center justify-between gap-4 rounded-[1.35rem] border border-[#3a252b] bg-[#1b1014] px-5 py-4 text-left shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#ff7f95]">
                      Estado de sesión
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#f0c7d0]">{authMessage}</p>
                  </div>
                  <button
                    className="shrink-0 rounded-xl bg-[#19c37d] px-4 py-2 text-sm font-semibold text-[#04120c] transition hover:bg-[#28d389]"
                    onClick={() => openAuth("login")}
                    type="button"
                  >
                    Inicia sesión
                  </button>
                </div>
              ) : null}

              <div className="inline-flex items-center gap-2 rounded-full border border-[#18231f] bg-[#0d1512] px-4 py-2 text-xs font-medium text-[#1fd68a] shadow-[inset_0_0_0_1px_rgba(31,214,138,0.08)]">
                <PulseIcon className="h-4 w-4" />
                Rastreo en tiempo real garantizado
              </div>

              <h1 className="mt-8 text-5xl font-extrabold leading-[0.95] tracking-[-0.06em] text-white md:text-7xl">
                Centraliza tu cartera
                <span className="mt-2 block bg-gradient-to-r from-[#28d389] via-[#21c87f] to-[#10a863] bg-clip-text text-transparent">
                  en un solo lugar.
                </span>
              </h1>

              <p className="mx-auto mt-8 max-w-[820px] text-lg leading-9 text-[#8b95a5] md:text-[1.05rem]">
                El portfolio tracker definitivo para inversores serios. Conecta tus exchanges
                y brokers sin ceder la custodia de tus activos. Solo visualización y análisis
                de alto rendimiento.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <button
                  className="inline-flex min-w-[280px] items-center justify-center gap-2 rounded-2xl bg-[#19c37d] px-7 py-4 text-lg font-semibold text-[#04120c] shadow-[0_26px_60px_rgba(25,195,125,0.24)] transition hover:bg-[#28d389]"
                  onClick={() => openAuth("register")}
                  suppressHydrationWarning
                  type="button"
                >
                  Crea tu cuenta gratis
                  <ArrowRightIcon className="h-5 w-5" />
                </button>
                <a
                  className="inline-flex min-w-[280px] items-center justify-center rounded-2xl bg-[#111317] px-7 py-4 text-lg font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition hover:bg-[#151a21]"
                  href="#preview"
                >
                  Explora la demo interactiva
                </a>
              </div>

              <p className="mt-6 flex items-center justify-center gap-2 text-sm text-[#7d8fa3]">
                <ShieldIcon className="h-4 w-4 text-[#1fd68a]" />
                No es un exchange. Tus claves y fondos permanecen 100% seguros contigo.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-[#0f141b] bg-[#07090d] py-12" id="preview">
          <div className="mx-auto max-w-[1440px] px-6">
            <div className="overflow-hidden rounded-[2rem] bg-[#0d1117] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] ring-1 ring-[#171c24] md:p-6">
              <div className="mb-5 flex items-center gap-2 px-2">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
                <section className="rounded-[1.7rem] bg-[#11151b] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.22)] ring-1 ring-[#171d25]">
                  <p className="text-[0.76rem] font-semibold uppercase tracking-[0.18em] text-[#7d8798]">Mercado en vivo</p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-4xl font-extrabold tracking-[-0.06em] text-white">
                        {formatCompactUsd(globalStats.marketCapUsd)}
                      </p>
                      <div className="mt-2">
                        <ChangeChip value={globalStats.marketCapChangePercentage24hUsd} />
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[#0d1117] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
                      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#7f8998]">Dominancia BTC</p>
                      <p className="mt-2 text-xl font-bold text-white">{formatPercent(globalStats.btcDominance, 1)}</p>
                    </div>
                  </div>
                  <div className="mt-8">
                    <CompositePreviewChart data={compositeSeries} />
                  </div>
                </section>

                <section className="rounded-[1.7rem] bg-[#11151b] p-6 shadow-[0_18px_50px_rgba(0,0,0,0.22)] ring-1 ring-[#171d25]">
                  <p className="text-[0.76rem] font-semibold uppercase tracking-[0.18em] text-[#7d8798]">Distribución por Activo</p>
                  <div className="mt-6 flex justify-center">
                    <AllocationDonut items={allocation} />
                  </div>
                  <div className="mt-6 space-y-3">
                    {allocation.map((item) => (
                      <div className="flex items-center justify-between gap-4 text-sm" key={item.symbol}>
                        <div className="flex items-center gap-3">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-[#dfe5ee]">{item.name}</span>
                        </div>
                        <span className="tabular-nums text-[#9ca6b5]">{item.share.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24" id="features">
          <div className="mx-auto max-w-[1440px] px-6">
            <div className="mx-auto max-w-[820px] text-center">
              <h2 className="text-[2.4rem] font-bold tracking-[-0.05em] text-white">
                Diseñado para la claridad. Construido para la seguridad.
              </h2>
              <p className="mt-4 text-base leading-8 text-[#7c8799]">
                No somos una wallet, un exchange ni un broker: somos la capa visual y de
                análisis que necesitas para operar con criterio.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              <FeatureCard
                description="Conecta tus exchanges mediante conexión segura sin mover la custodia de tus activos."
                icon={<ShieldIcon className="h-5 w-5 text-[#1fd68a]" />}
                title="100% Sin Custodia"
              />
              <FeatureCard
                description={`Precios reales integrados vía CoinGecko: ${assets.length || 0} activos vivos y mercado público actualizado.`}
                icon={<PulseIcon className="h-5 w-5 text-[#4f8dff]" />}
                title="Datos en Tiempo Real"
              />
              <FeatureCard
                description={`Tendencias y señales con ${trending.length || 0} activos en búsqueda destacada y cobertura multi-activo.`}
                icon={<ChartIcon className="h-5 w-5 text-[#f6a63b]" />}
                title="Soporte Multi-Activo"
              />
            </div>
          </div>
        </section>

        <section className="border-y border-[#0f141b] py-20" id="integrations">
          <div className="mx-auto grid max-w-[1440px] gap-16 px-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="inline-flex rounded-full bg-[#0f171d] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#8ba2ff] shadow-[inset_0_0_0_1px_rgba(139,162,255,0.12)]">
                Integraciones
              </div>
              <h2 className="mt-6 text-[2.3rem] font-bold tracking-[-0.05em] text-white">
                Se conecta con tus plataformas favoritas.
              </h2>
              <p className="mt-4 max-w-[620px] text-base leading-8 text-[#7c8799]">
                Estás entrando a una vista real: diferentes visualizaciones, feed de activos y
                snapshots del mercado ya salen de tus rutas internas y proxies vivos.
              </p>
              <ul className="mt-8 space-y-3 text-sm text-[#b4bdca]">
                <li className="flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-[#1fd68a]" />Top gainer 24h: {gainers[0]?.name ?? "Sin dato"} con {formatSignedPercent(gainers[0]?.change24h)}</li>
                <li className="flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-[#1fd68a]" />Capitalización global: {formatCompactUsd(globalStats.marketCapUsd)}</li>
                <li className="flex items-center gap-3"><span className="h-1.5 w-1.5 rounded-full bg-[#1fd68a]" />Volumen diario vivo: {formatCompactUsd(globalStats.volume24hUsd)}</li>
              </ul>
              <a className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[#1fd68a]" href="#community">
                Ver más detalles de la plataforma
                <ArrowRightIcon className="h-4 w-4" />
              </a>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {PARTNER_CHIPS.map((partner) => (
                <div
                  className="flex min-h-[88px] items-center justify-center rounded-[1.5rem] bg-[#11151b] text-sm font-semibold text-[#dce4ef] shadow-[0_16px_45px_rgba(0,0,0,0.2)] ring-1 ring-[#171d25]"
                  key={partner}
                >
                  {partner}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20" id="community">
          <div className="mx-auto max-w-[1440px] px-6">
            <div className="mx-auto max-w-[820px] text-center">
              <h2 className="text-[2.35rem] font-bold tracking-[-0.05em] text-white">
                Entiende la diferencia. Toma el control.
              </h2>
            </div>

            <div className="mx-auto mt-12 grid max-w-[920px] gap-6 md:grid-cols-2">
              <ComparisonCard
                accent="red"
                items={[
                  "Custodia de activos ajena a tu cartera.",
                  "Visión fragmentada entre varias cuentas.",
                  "Menor contexto al analizar holdings y movimientos.",
                ]}
                title="Lo que hace un exchange o wallet"
              />
              <ComparisonCard
                accent="green"
                items={[
                  "Agrega precios, histórico y señales en un solo lugar.",
                  "Conecta múltiples fuentes sin mover custodia.",
                  "Ofrece análisis consolidado para decidir mejor.",
                ]}
                title="Lo que hace TRACKER"
              />
            </div>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button
                className="rounded-xl bg-[#12161d] px-5 py-3 text-sm font-semibold text-[#dbe3ee] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition hover:bg-[#171c24]"
                onClick={() => openAuth("register")}
                suppressHydrationWarning
                type="button"
              >
                Salta directo y crea tu cuenta
              </button>
              <a
                className="rounded-xl bg-[#12161d] px-5 py-3 text-sm font-semibold text-[#dbe3ee] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] transition hover:bg-[#171c24]"
                href="#features"
              >
                Vuelve a la comunidad
              </a>
            </div>
          </div>
        </section>

        <footer className="border-t border-[#0f141b] py-10">
          <div className="mx-auto grid max-w-[1440px] gap-8 px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#19c37d] text-[#04120c]">
                  <TriangleIcon className="h-4 w-4" />
                </div>
                <span className="font-bold tracking-[-0.04em] text-white">TRACKER</span>
              </div>
              <p className="mt-4 max-w-[280px] text-sm leading-7 text-[#7c8799]">
                La experiencia pública muestra señales y mercado vivo antes del onboarding,
                pero conserva intactos tus flujos funcionales de acceso.
              </p>
            </div>
            <FooterColumn
              links={["Dashboard", "Portfolio", "Mercados", "Analíticas"]}
              title="Producto"
            />
            <FooterColumn
              links={["Documentación API", "Blog y novedades", "Estado del sistema"]}
              title="Recursos"
            />
            <FooterColumn
              links={["Iniciar sesión", "Registro", "Ayuda de acceso"]}
              title="Acceso"
            />
          </div>
        </footer>
      </main>

      <AuthDialog
        mode={authMode}
        oauthErrorMessage={authMessage}
        onClose={() => setAuthOpen(false)}
        onModeChange={setAuthMode}
        onRegistered={handleRegistered}
        open={authOpen}
        prefilledEmail={prefilledEmail}
      />
    </>
  );
}

function TopTicker({ assets }: { assets: MarketRow[] }) {
  const rows = assets.slice(0, 8);

  return (
    <div className="border-b border-[#0d1218] bg-[#030507] py-2.5">
      <div className="mx-auto max-w-[1600px] overflow-hidden px-4">
        <div className="flex w-max items-center gap-10 whitespace-nowrap text-sm font-medium text-[#d2d8e1] animate-[public-marquee_36s_linear_infinite]">
          {[...rows, ...rows, ...rows].map((asset, index) => (
            <div className="flex items-center gap-3" key={`${asset.id}-${index}`}>
              <span className="text-[#909caf]">{asset.symbol}</span>
              <span className="tabular-nums text-white">{formatUsd(asset.price)}</span>
              <span className={(asset.change24h ?? 0) >= 0 ? "text-[#1fd68a]" : "text-[#ff5c7c]"}>
                {formatSignedPercent(asset.change24h)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompositePreviewChart({ data }: { data: number[] }) {
  if (!data.length) {
    return <div className="h-[260px] rounded-[1.5rem] bg-[#0d1117]" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 760;
      const y = 240 - ((value - min) / span) * 170;
      return `${x},${y}`;
    })
    .join(" ");

  const area = `0,240 ${points} 760,240`;

  return (
    <div className="rounded-[1.5rem] bg-[#0c1015] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
      <svg className="h-[260px] w-full" preserveAspectRatio="none" viewBox="0 0 760 260">
        <defs>
          <linearGradient id="public-preview-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(31,214,138,0.22)" />
            <stop offset="100%" stopColor="rgba(31,214,138,0.02)" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((line) => (
          <line
            key={line}
            stroke="#1a2028"
            strokeDasharray="4 8"
            strokeWidth="1"
            x1="0"
            x2="760"
            y1={36 + line * 52}
            y2={36 + line * 52}
          />
        ))}
        <polyline fill="url(#public-preview-fill)" points={area} />
        <polyline
          fill="none"
          points={points}
          stroke="#1fd68a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
      </svg>
    </div>
  );
}

function AllocationDonut({
  items,
}: {
  items: Array<{ color: string; name: string; share: number; symbol: string }>;
}) {
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg className="h-[220px] w-[220px]" viewBox="0 0 220 220">
      <circle cx="110" cy="110" fill="none" r={radius} stroke="#171d25" strokeWidth="22" />
      {items.map((item) => {
        const length = (item.share / 100) * circumference;
        const dashOffset = -offset;
        offset += length;
        return (
          <circle
            cx="110"
            cy="110"
            fill="none"
            key={item.symbol}
            r={radius}
            stroke={item.color}
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            strokeWidth="22"
            transform="rotate(-90 110 110)"
          />
        );
      })}
      <text fill="#ffffff" fontSize="36" fontWeight="700" textAnchor="middle" x="110" y="104">
        {items.length}
      </text>
      <text fill="#7c8799" fontSize="16" textAnchor="middle" x="110" y="130">
        Activos
      </text>
    </svg>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-[1.65rem] bg-[#0f1217] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] ring-1 ring-[#171c24]">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#121720] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
        {icon}
      </div>
      <h3 className="mt-5 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-[#7c8799]">{description}</p>
    </article>
  );
}

function ComparisonCard({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[];
  accent: "green" | "red";
}) {
  const accentStyles =
    accent === "green"
      ? "shadow-[inset_0_0_0_1px_rgba(31,214,138,0.2)]"
      : "shadow-[inset_0_0_0_1px_rgba(255,92,124,0.18)]";
  const iconColor = accent === "green" ? "text-[#1fd68a]" : "text-[#ff5c7c]";

  return (
    <article className={`rounded-[1.7rem] bg-[#0f1217] p-6 ${accentStyles}`}>
      <div className={`flex items-center gap-2 text-sm font-semibold ${iconColor}`}>
        <PulseIcon className="h-4 w-4" />
        {title}
      </div>
      <ul className="mt-5 space-y-3 text-sm leading-7 text-[#c3ccd9]">
        {items.map((item) => (
          <li className="flex gap-3" key={item}>
            <span className={`mt-2 h-1.5 w-1.5 rounded-full ${accent === "green" ? "bg-[#1fd68a]" : "bg-[#ff5c7c]"}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <ul className="mt-4 space-y-3 text-sm text-[#7c8799]">
        {links.map((link) => (
          <li key={link}>{link}</li>
        ))}
      </ul>
    </div>
  );
}

function mapTrending(trendingAssets: TrendingMarketAsset[], assets: MarketRow[]) {
  const rowsBySymbol = new Map<string, MarketRow>();
  assets.forEach((asset) => rowsBySymbol.set(asset.symbol, asset));
  return trendingAssets.map((asset) => {
    const matched = rowsBySymbol.get(asset.symbol.toUpperCase());
    return {
      id: asset.id,
      name: matched?.name ?? asset.name,
      symbol: asset.symbol.toUpperCase(),
      price: matched?.price ?? null,
    };
  });
}

function buildCompositeSeries(assets: MarketRow[]) {
  const valid = assets.filter((asset) => asset.sparkline.length > 0);
  if (!valid.length) return [];

  const minLength = Math.min(...valid.map((asset) => asset.sparkline.length));
  if (!Number.isFinite(minLength) || minLength <= 0) return [];

  const weights = valid.map((asset) => asset.marketCap ?? 1);
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;

  return Array.from({ length: minLength }, (_, index) => {
    return valid.reduce((sum, asset, assetIndex) => {
      const point = asset.sparkline[index] ?? asset.price;
      return sum + point * (weights[assetIndex] / totalWeight);
    }, 0);
  });
}

function buildAllocation(assets: MarketRow[]) {
  const palette = ["#ff9d1d", "#5b8ff9", "#22d38c", "#b77cff"];
  const total = assets.reduce((sum, asset) => sum + (asset.marketCap ?? 0), 0) || 1;

  return assets.slice(0, 4).map((asset, index) => ({
    color: palette[index] ?? "#9aa4b2",
    name: asset.name,
    symbol: asset.symbol,
    share: ((asset.marketCap ?? 0) / total) * 100,
  }));
}

function formatCompactUsd(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatUsd(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  if (Math.abs(value) >= 1) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  }).format(value);
}

function formatPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return `${Math.abs(value).toFixed(digits)}%`;
}

function formatSignedPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(digits)}%`;
}

function ChangeChip({ value }: { value: number | null }) {
  const positive = (value ?? 0) >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${
        positive ? "bg-[#0f241a] text-[#22d38c]" : "bg-[#251118] text-[#ff5c7c]"
      }`}
    >
      {positive ? <ArrowUpRightIcon className="h-3.5 w-3.5" /> : <ArrowDownRightIcon className="h-3.5 w-3.5" />}
      {formatSignedPercent(value)}
    </span>
  );
}

const EMPTY_GLOBAL_STATS: MarketOverviewStats = {
  marketCapUsd: null,
  marketCapChangePercentage24hUsd: null,
  volume24hUsd: null,
  volume24hChangePercentage: null,
  btcDominance: null,
};

function IconWrapper({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}

function TriangleIcon({ className }: { className?: string }) {
  return (
    <IconWrapper className={className}>
      <path d="M12 4L5 20H19L12 4Z" fill="currentColor" />
    </IconWrapper>
  );
}

function PulseIcon({ className }: { className?: string }) {
  return (
    <IconWrapper className={className}>
      <path d="M3 12H7L9.2 7L12.8 17L15 12H21" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </IconWrapper>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <IconWrapper className={className}>
      <path d="M12 3L19 6V11.5C19 16 15.9 19.95 12 21C8.1 19.95 5 16 5 11.5V6L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M9.25 12L11.1 13.85L14.75 10.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </IconWrapper>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <IconWrapper className={className}>
      <path d="M4 18L10 12L14 15L20 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M15 8H20V13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </IconWrapper>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <IconWrapper className={className}>
      <path d="M5 12H19" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M13 6L19 12L13 18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </IconWrapper>
  );
}

function ArrowUpRightIcon({ className }: { className?: string }) {
  return (
    <IconWrapper className={className}>
      <path d="M7 17L17 7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M10 7H17V14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </IconWrapper>
  );
}

function ArrowDownRightIcon({ className }: { className?: string }) {
  return (
    <IconWrapper className={className}>
      <path d="M7 7L17 17" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M10 17H17V10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </IconWrapper>
  );
}
