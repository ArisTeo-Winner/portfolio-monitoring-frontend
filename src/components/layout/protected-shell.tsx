"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ArrowLeftRight,
  Bell,
  Briefcase,
  ChevronDown,
  FileText,
  Globe,
  Home,
  Key,
  LineChart,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  User,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AddTransactionModal } from "@/components/transactions/add-transaction-modal";
import { logout } from "@/features/auth/api/logout";
import { clearSession, persistSession, readSession } from "@/features/auth/lib/session";
import { env } from "@/lib/config/env";
import { endpoints } from "@/lib/api/endpoints";
import { getPortfolio } from "@/features/portfolio/api/get-portfolio";
import { getMe } from "@/features/users/api/get-me";
import type { UserResponse } from "@/features/users/types/user.types";
import { isMercadosNavEnabled } from "@/lib/navigation/nav-features";
import { getPortfolioNavBadge } from "@/lib/navigation/release-badges";
import { formatSignedCurrency } from "@/lib/utils/format";

type NavItem = {
  href: string;
  label: string;
  mobileLabel: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  comingSoon?: boolean;
};

type ActiveDropdown =
  | "locale"
  | "notifications"
  | "settings"
  | "profile"
  | "search-mobile"
  | null;

export function ProtectedShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const navRef = useRef<HTMLElement | null>(null);
  const marketsEnabled = isMercadosNavEnabled();

  const [loggingOut, setLoggingOut] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdown>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [user, setUser] = useState<UserResponse | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<{
    total: string;
    changeValue: string;
    changePercent: string;
    positive: boolean;
  } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (navRef.current && target instanceof Node && !navRef.current.contains(target)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const session = readSession();

      if (session?.accessToken) {
        // Access token already in memory — session is live.
        if (!cancelled) {
          setSessionReady(true);
          getMe().then(setUser).catch(() => {});
        }
        return;
      }

      // No token in memory (e.g. after a page reload).
      // Attempt silent session recovery via the HttpOnly refresh-token cookie.
      try {
        const response = await fetch(`${env.apiBaseUrl}${endpoints.auth.refresh}`, {
          method: "POST",
          cache: "no-store",
          // The HttpOnly refresh-token cookie must be sent to the backend.
          credentials: "include",
          // Bound the wait so a cold-starting/slow backend can't strand the
          // user on the loading skeleton — fall through to the login redirect.
          signal: AbortSignal.timeout(8_000),
        });

        if (response.ok) {
          const body = (await response.json()) as Record<string, unknown>;
          if (typeof body?.accessToken === "string") {
            persistSession(body.accessToken);
            if (!cancelled) {
              setSessionReady(true);
              getMe().then(setUser).catch(() => {});
            }
            return;
          }
        }
      } catch {
        // Network error — fall through to redirect.
      }

      // Refresh failed (no valid cookie or server error) → send to login.
      if (!cancelled) {
        router.replace("/login");
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setActiveDropdown(null);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  const refreshPortfolioTotal = useCallback(async (force = false) => {
    try {
      const entries = await getPortfolio({ force });
      const total = entries.reduce((acc, entry) => acc + Number(entry.currentValue), 0);
      const invested = entries.reduce((acc, entry) => acc + Number(entry.totalInvested), 0);
      const profitLoss = entries.reduce((acc, entry) => acc + Number(entry.totalProfitLoss), 0);
      const percent = invested > 0 ? (profitLoss / invested) * 100 : 0;

      setPortfolioSummary({
        total: formatHeaderCurrency(total),
        changeValue: formatSignedCurrency(profitLoss),
        changePercent: `${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%`,
        positive: profitLoss >= 0,
      });
    } catch {
      setPortfolioSummary(null);
    }
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    void refreshPortfolioTotal();
  }, [pathname, refreshPortfolioTotal, sessionReady]);

  useEffect(() => {
    if (!sessionReady) return;

    const handleRefresh = () => {
      void refreshPortfolioTotal(true);
    };

    const handleFocus = () => {
      void refreshPortfolioTotal();
    };

    window.addEventListener("portfolio:refresh", handleRefresh);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("portfolio:refresh", handleRefresh);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshPortfolioTotal, sessionReady]);

  const toggleDropdown = (name: Exclude<ActiveDropdown, null>) => {
    setActiveDropdown((current) => (current === name ? null : name));
  };

  const handleMobileNavigation = useCallback(
    (href: string) => {
      setActiveDropdown(null);
      setIsMobileMenuOpen(false);

      if (pathname !== href) {
        router.push(href);
      }

      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          window.scrollTo(0, 0);
        });
      }
    },
    [pathname, router],
  );

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await logout();
    } catch {
      // Clear local session even if remote logout fails.
    } finally {
      clearSession();
      router.replace("/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  const displayInitial =
    user?.firstName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U";
  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ""}`.trim()
    : user?.username || "Usuario";
  const displayUsername = user?.username || user?.email?.split("@")[0] || "inv_user";
  const displayEmail = user?.email || "usuario@correo.com";
  const navItems = buildPrimaryNav(marketsEnabled);
  const mobileBottomNav = buildMobileBottomNav(marketsEnabled);
  if (!sessionReady) {
    return (
      <div className="min-h-dvh bg-[#08090d] text-zinc-50">
        <div className="mx-auto max-w-[1440px] px-4 py-4 md:px-6 md:py-6 lg:px-8">
          <div className="h-20 animate-pulse rounded-2xl bg-[#101216]" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#0F1116] font-sans text-zinc-50 selection:bg-emerald-500/30 md:bg-[#09090b]">
      <header
        ref={navRef}
        className="sticky top-0 z-50 border-b border-[#262D3D] bg-[#0F1116]/95 backdrop-blur-md md:border-zinc-800/60 md:bg-[#09090b]/90"
      >
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-3 py-2 md:h-16 md:px-6 md:py-0 lg:px-8">
          <Link className="flex shrink-0 items-center gap-2" href="/dashboard">
            <div className="rounded-full bg-zinc-50 p-1.5 shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              <svg
                fill="none"
                height="14"
                viewBox="0 0 24 24"
                width="14"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2L2 22H22L12 2Z" fill="#09090b" />
              </svg>
            </div>
            <span className="text-[1rem] font-bold tracking-tight text-zinc-50 md:text-lg">TRACKER</span>
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center gap-1 lg:flex xl:gap-2">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              if (item.comingSoon) {
                return (
                  <span
                    className="inline-flex min-w-0 cursor-default items-center gap-2 rounded-full px-2.5 py-2 text-sm font-medium opacity-45 xl:px-3"
                    key={item.label}
                    title="Próximamente"
                  >
                    <span className="whitespace-nowrap text-zinc-400">{item.label}</span>
                    <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#7f8aa3]">
                      Soon
                    </span>
                  </span>
                );
              }

              return (
                <Link
                  className={`inline-flex min-w-0 items-center gap-2 rounded-full px-2.5 py-2 text-sm transition xl:px-3 ${
                    active
                      ? "bg-[#11161a] font-semibold text-white"
                      : "font-medium text-zinc-400 hover:bg-[#111317] hover:text-white"
                  }`}
                  href={item.href}
                  key={item.label}
                >
                  <span className="whitespace-nowrap">{item.label}</span>
                  {item.badge ? <NavBadge>{item.badge}</NavBadge> : null}
                </Link>
              );
            })}
          </nav>

          <div className="hidden shrink-0 items-center gap-1.5 lg:flex xl:gap-2">
            <DesktopBalanceSummary
              onAddAsset={() => setAddModalOpen(true)}
              summary={portfolioSummary}
            />

            <div className="relative hidden w-44 xl:block xl:w-56 2xl:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 pl-9 pr-4 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Buscar activos, txs..."
                type="text"
                value={searchValue}
              />
            </div>

            <div className="relative">
              <DesktopIconButton
                active={activeDropdown === "locale"}
                ariaLabel="Idioma y moneda"
                onClick={() => toggleDropdown("locale")}
              >
                <Globe className="h-5 w-5" />
              </DesktopIconButton>
              {activeDropdown === "locale" ? (
                <DesktopPopover align="right">
                  <PopoverSectionTitle>Idioma</PopoverSectionTitle>
                  <PopoverAction active>ES Espanol</PopoverAction>
                  <PopoverAction>US English</PopoverAction>
                  <div className="my-2 border-t border-zinc-800/60" />
                  <PopoverSectionTitle>Moneda Base</PopoverSectionTitle>
                  <PopoverAction active>USD - Dolar</PopoverAction>
                  <PopoverAction>EUR - Euro</PopoverAction>
                  <PopoverAction>MXN - Peso Mex</PopoverAction>
                </DesktopPopover>
              ) : null}
            </div>

            <div className="relative">
              <DesktopIconButton
                active={activeDropdown === "notifications"}
                ariaLabel="Notificaciones"
                onClick={() => toggleDropdown("notifications")}
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full border border-[#09090b] bg-emerald-500" />
              </DesktopIconButton>
              {activeDropdown === "notifications" ? (
                <DesktopPopover align="right" wide>
                  <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3">
                    <h4 className="text-sm font-bold text-zinc-50">Notificaciones</h4>
                    <button className="text-xs font-medium text-emerald-500 hover:text-emerald-400" type="button">
                      Marcar leidas
                    </button>
                  </div>
                  <div className="px-4 py-3">
                    <NotificationItem />
                  </div>
                  <div className="border-t border-zinc-800/60 px-4 py-2 text-center">
                    <button className="text-xs font-medium text-zinc-400 hover:text-zinc-50" type="button">
                      Ver todas las notificaciones
                    </button>
                  </div>
                </DesktopPopover>
              ) : null}
            </div>

            <div className="relative">
              <DesktopIconButton
                active={activeDropdown === "settings"}
                ariaLabel="Configuracion"
                onClick={() => toggleDropdown("settings")}
              >
                <Settings className="h-5 w-5" />
              </DesktopIconButton>
              {activeDropdown === "settings" ? (
                <DesktopPopover align="right">
                  <PopoverSectionTitle>Preferencias</PopoverSectionTitle>
                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-sm text-zinc-300">Tema visual</span>
                    <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
                      <button className="rounded-md p-1 text-zinc-500 hover:text-zinc-300" type="button">
                        <Sun className="h-3.5 w-3.5" />
                      </button>
                      <button className="rounded-md bg-zinc-800 p-1 text-zinc-50" type="button">
                        <Moon className="h-3.5 w-3.5" />
                      </button>
                      <button className="rounded-md p-1 text-zinc-500 hover:text-zinc-300" type="button">
                        <Monitor className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="my-2 border-t border-zinc-800/60" />
                  <PopoverSectionTitle>Gestion</PopoverSectionTitle>
                  <PopoverLink href="/settings/preferences">
                    <Monitor className="h-4 w-4 text-zinc-400" />
                    Preferencias
                  </PopoverLink>
                  <PopoverLink href="/settings/security">
                    <ShieldCheck className="h-4 w-4 text-zinc-400" />
                    Seguridad (2FA, Tokens)
                  </PopoverLink>
                </DesktopPopover>
              ) : null}
            </div>

            <div className="relative ml-1">
              <button
                className={`inline-flex items-center gap-2 rounded-full border px-2 py-1 transition ${
                  activeDropdown === "profile"
                    ? "border-zinc-700 bg-zinc-800"
                    : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-800"
                }`}
                onClick={() => toggleDropdown("profile")}
                type="button"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-xs font-bold text-emerald-500">
                  {displayInitial}
                </div>
                <div className="hidden min-w-0 text-left 2xl:block">
                  <p className="truncate text-xs font-semibold text-zinc-100">{displayName}</p>
                  <p className="truncate text-[11px] text-zinc-500">{displayUsername}</p>
                </div>
              </button>
              {activeDropdown === "profile" ? (
                <DesktopPopover align="right">
                  <div className="mb-2 flex items-center gap-3 border-b border-zinc-800/60 px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-base font-bold text-emerald-500">
                      {displayInitial}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-zinc-50">{displayName}</p>
                      <p className="truncate text-xs text-zinc-500">{displayEmail}</p>
                    </div>
                  </div>
                  <PopoverLink href="/settings/account">
                    <User className="h-4 w-4 text-zinc-400" />
                    Resumen de Cuenta
                  </PopoverLink>
                  <PopoverLink href="#">
                    <Wallet className="h-4 w-4 text-zinc-400" />
                    Mis Carteras
                  </PopoverLink>
                  <PopoverLink href="#">
                    <FileText className="h-4 w-4 text-zinc-400" />
                    Importar CSV
                  </PopoverLink>
                  <PopoverLink href="/settings/preferences">
                    <Key className="h-4 w-4 text-zinc-400" />
                    Preferencias
                  </PopoverLink>
                  <div className="my-2 border-t border-zinc-800/60" />
                  <button
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm font-medium text-rose-500 transition hover:bg-rose-500/10"
                    disabled={loggingOut}
                    onClick={() => {
                      setActiveDropdown(null);
                      void handleLogout();
                    }}
                    type="button"
                  >
                    <LogOut className="h-4 w-4" />
                    {loggingOut ? "Cerrando..." : "Cerrar sesion"}
                  </button>
                </DesktopPopover>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#0e7a4f] px-3 text-[0.875rem] font-medium text-white transition active:brightness-110 md:h-10 md:px-4 md:text-sm md:font-semibold md:hover:bg-[#11945f]"
              onClick={() => setAddModalOpen(true)}
              type="button"
            >
              <Plus className="h-4 w-4" />
              Activo
            </button>

            <MobileIconButton
              ariaLabel="Buscar"
              onClick={() => {
                setIsMobileMenuOpen(false);
                toggleDropdown("search-mobile");
              }}
            >
              <Search className="h-5 w-5" />
            </MobileIconButton>

            <MobileIconButton
              ariaLabel="Notificaciones"
              onClick={() => {
                setIsMobileMenuOpen(false);
                toggleDropdown("notifications");
              }}
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full border border-[#09090b] bg-emerald-500" />
            </MobileIconButton>

            <MobileIconButton
              active={isMobileMenuOpen}
              ariaLabel={isMobileMenuOpen ? "Cerrar menu" : "Abrir menu"}
              onClick={() => {
                setActiveDropdown(null);
                setIsMobileMenuOpen((current) => !current);
              }}
              testId="mobile-menu-btn"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </MobileIconButton>
          </div>
        </div>

        {activeDropdown === "search-mobile" ? (
          <div className="border-b border-zinc-800 bg-[#09090b] px-4 py-4 lg:hidden">
            <div className="mx-auto max-w-[1440px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  autoFocus
                  className="h-11 w-full rounded-xl border border-zinc-700 bg-[#121214] pl-10 pr-4 text-sm text-zinc-50 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Buscar activos, transacciones..."
                  type="text"
                  value={searchValue}
                />
              </div>
            </div>
          </div>
        ) : null}

        {activeDropdown === "notifications" ? (
          <div className="border-b border-zinc-800 bg-[#09090b] px-4 py-4 lg:hidden">
            <div className="mx-auto max-w-[1440px]">
              <h4 className="mb-3 text-sm font-bold text-zinc-50">Notificaciones</h4>
              <NotificationItem />
            </div>
          </div>
        ) : null}

      </header>

      {isMobileMenuOpen ? (
        <>
          <button
            aria-label="Cerrar menu"
            className="fixed inset-0 z-[59] bg-black/70 backdrop-blur-[2px] lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            type="button"
          />
          <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#0b0c10] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] text-white lg:hidden">
            <div className="min-h-full px-4">
              <div className="flex min-h-[72px] items-center gap-3 border-b border-zinc-800/60 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/18 text-[0.8125rem] font-bold text-emerald-400">
                  {displayInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.875rem] font-semibold text-zinc-50">{displayName}</p>
                  <p className="mt-0.5 truncate text-[0.75rem] text-zinc-500">{displayEmail}</p>
                </div>
                <button
                  aria-label="Cerrar perfil"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition active:bg-zinc-800 active:text-white"
                  onClick={() => setIsMobileMenuOpen(false)}
                  type="button"
                >
                  <X className="h-[18px] w-[18px]" />
                </button>
              </div>

              <ProfileSectionLabel>Preferencias</ProfileSectionLabel>
              <div>
                <ProfileRow
                  icon={<Globe className="h-[18px] w-[18px]" />}
                  label="Moneda base"
                  onClick={() => handleMobileNavigation("/settings/preferences")}
                  value="USD - Dolar"
                />
                <ProfileRow
                  icon={<Moon className="h-[18px] w-[18px]" />}
                  label="Tema"
                  onClick={() => handleMobileNavigation("/settings/preferences")}
                  value="Oscuro"
                />
              </div>

              <ProfileSectionLabel>Cuenta</ProfileSectionLabel>
              <div>
                <ProfileRow
                  icon={<User className="h-[18px] w-[18px]" />}
                  label="Email"
                  onClick={() => handleMobileNavigation("/settings/account")}
                  value={displayEmail}
                />
                <ProfileRow
                  icon={<Key className="h-[18px] w-[18px]" />}
                  label="Cambiar contrasena"
                  onClick={() => handleMobileNavigation("/settings/security")}
                  value="Password"
                />
                <ProfileRow
                  icon={<ShieldCheck className="h-[18px] w-[18px]" />}
                  label="Seguridad / 2FA"
                  onClick={() => handleMobileNavigation("/settings/security")}
                  value="Configurar"
                />
              </div>

              <ProfileSectionLabel>Soporte</ProfileSectionLabel>
              <div>
                <ProfileRow icon={<FileText className="h-[18px] w-[18px]" />} label="FAQ" />
                <ProfileRow icon={<FileText className="h-[18px] w-[18px]" />} label="Terminos" />
                <ProfileRow icon={<FileText className="h-[18px] w-[18px]" />} label="Politica" />
              </div>

              <div className="mt-4">
                <button
                  className="flex min-h-12 w-full items-center gap-3 border-t border-zinc-800/60 py-2.5 text-left text-[0.875rem] font-medium text-rose-500 transition active:bg-rose-500/10"
                  data-testid="logout-button"
                  disabled={loggingOut}
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    void handleLogout();
                  }}
                  type="button"
                >
                  <LogOut className="h-[18px] w-[18px] shrink-0" />
                  <span>{loggingOut ? "Cerrando..." : "Salir"}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <div className="mx-auto max-w-[1440px] px-3 py-2 pb-24 md:px-6 md:py-6 md:pb-28 lg:px-8 lg:pb-6">
        {children}
      </div>

      <nav data-testid="bottom-navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#262D3D] bg-[#0F1116]/95 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-[1440px] grid-cols-4 gap-2">
          {mobileBottomNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const ItemIcon = item.icon;

            if (item.comingSoon) {
              return (
                <div
                  className="flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center opacity-35"
                  key={item.href}
                >
                  <ItemIcon className="h-5 w-5 text-[#7D8596]" />
                  <span className="text-[0.6875rem] font-medium text-[#7D8596]">{item.mobileLabel}</span>
                </div>
              );
            }

            return (
              <button
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center transition ${
                  active
                    ? "bg-[#151922] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]"
                    : "text-[#7D8596] hover:bg-[#151922] hover:text-[#B0B6C3]"
                }`}
                data-testid={`nav-${item.href.slice(1)}`}
                key={item.href}
                onClick={() => handleMobileNavigation(item.href)}
                type="button"
              >
                <ItemIcon className={`h-5 w-5 ${active ? "text-[#2ee59d]" : ""}`} />
                <span className="text-[0.6875rem] font-medium">{item.mobileLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <AddTransactionModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onCreated={async () => {
          window.dispatchEvent(new Event("portfolio:refresh"));
          await refreshPortfolioTotal(true);
          router.refresh();
        }}
        requireAssetTypeSelection
      />
    </div>
  );
}

function DesktopBalanceSummary({
  summary,
  onAddAsset,
}: {
  summary: {
    total: string;
    changeValue: string;
    changePercent: string;
    positive: boolean;
  } | null;
  onAddAsset: () => void;
}) {
  return (
    <div className="mr-1 hidden h-10 items-center rounded-xl border border-zinc-800 bg-[#121214] p-1 lg:flex 2xl:hidden">
      <div className="px-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Balance total
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="tabular-nums text-sm font-medium text-zinc-50">
            {summary?.total ?? "$0.00"}
          </span>
          <SummaryPill summary={summary} />
        </div>
      </div>
      <button
        className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg bg-emerald-500 px-2.5 text-xs font-medium leading-none text-zinc-950 transition hover:bg-emerald-400"
        onClick={onAddAsset}
        type="button"
      >
        + Activo
      </button>
    </div>
  );
}

function SummaryPill({
  summary,
}: {
  summary: {
    changeValue: string;
    changePercent: string;
    positive: boolean;
  } | null;
}) {
  const positive = summary?.positive !== false;
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold ${
        positive ? "bg-[#103427] text-[#24d58f]" : "bg-[#30171d] text-[#ff5d73]"
      }`}
    >
      {summary ? `${summary.changeValue} ${summary.changePercent}` : "+$0.00 +0.00%"}
    </span>
  );
}

function DesktopIconButton({
  children,
  active = false,
  ariaLabel,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${
        active
          ? "bg-zinc-800 text-zinc-50"
          : "text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-50"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function MobileIconButton({
  children,
  active = false,
  ariaLabel,
  onClick,
  testId,
}: {
  children: ReactNode;
  active?: boolean;
  ariaLabel: string;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl transition md:h-10 md:w-10 ${
        active
          ? "bg-[#262D3D] text-white"
          : "bg-[#151922] text-[#B0B6C3] hover:bg-[#1B2130] hover:text-white"
      }`}
      data-testid={testId}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function DesktopPopover({
  children,
  wide = false,
}: {
  children: ReactNode;
  align?: "right";
  wide?: boolean;
}) {
  return (
    <div
      className={`absolute right-0 top-full z-50 mt-2 rounded-2xl border border-zinc-800 bg-[#121214] py-2 shadow-2xl ${
        wide ? "w-80" : "w-64"
      }`}
    >
      {children}
    </div>
  );
}

function PopoverSectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-zinc-600">
      {children}
    </div>
  );
}

function PopoverAction({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      className={`mx-2 block w-[calc(100%-1rem)] rounded-lg px-3 py-2 text-left text-sm transition ${
        active
          ? "bg-zinc-800/50 text-zinc-50"
          : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-50"
      }`}
      type="button"
    >
      {children}
    </button>
  );
}

function PopoverLink({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return (
    <a
      className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800/50 hover:text-zinc-50"
      href={href}
    >
      {children}
    </a>
  );
}

function NotificationItem() {
  return (
    <div className="flex gap-3 rounded-xl border border-zinc-800/40 bg-[#121214] px-4 py-3">
      <div className="mt-0.5 h-fit rounded-full border border-zinc-800 bg-zinc-900 p-1.5">
        <ArrowUpRight className="h-4 w-4 text-emerald-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-50">Sincronizacion Exitosa</p>
        <p className="mt-0.5 text-xs text-zinc-400">Tus transacciones estan al dia.</p>
        <p className="mt-1 text-[11px] text-zinc-500">Hace 2 min</p>
      </div>
    </div>
  );
}

function ProfileSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-zinc-600">
      {children}
    </p>
  );
}

function ProfileRow({
  icon,
  label,
  onClick,
  value,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  value?: string;
}) {
  return (
    <button
      className="flex min-h-12 w-full items-center gap-3 border-b border-zinc-800/60 py-2.5 text-left last:border-b-0 active:bg-zinc-900/70"
      onClick={onClick}
      type="button"
    >
      <span className="shrink-0 text-zinc-500">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-zinc-100">{label}</span>
      {value ? <span className="max-w-[48%] truncate text-right text-[0.8125rem] text-zinc-500">{value}</span> : null}
      <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-zinc-700" />
    </button>
  );
}

function NavBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#c4cede]">
      {children}
    </span>
  );
}

function formatHeaderCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function buildPrimaryNav(_marketsEnabled: boolean): NavItem[] {
  return [
    {
      href: "/dashboard",
      label: "Dashboard",
      mobileLabel: "Inicio",
      description: "Resumen general de tu patrimonio",
      icon: Home,
    },
    {
      href: "/mercados",
      label: "Mercados",
      mobileLabel: "Mercados",
      description: "Radar de precios, tendencias y watchlist",
      icon: LineChart,
      comingSoon: true,
    },
    {
      href: "/portfolio",
      label: "Portfolio",
      mobileLabel: "Portafolio",
      description: "Holdings, rendimiento y distribucion",
      icon: Briefcase,
      badge: getPortfolioNavBadge(),
    },
    {
      href: "/transactions",
      label: "Transacciones",
      mobileLabel: "Movimientos",
      description: "Compras, ventas y actividad reciente",
      icon: ArrowLeftRight,
    },
  ];
}

function buildMobileBottomNav(marketsEnabled: boolean) {
  return buildPrimaryNav(marketsEnabled).filter((item) =>
    item.href === "/dashboard" ||
    item.href === "/mercados" ||
    item.href === "/portfolio" ||
    item.href === "/transactions",
  ).slice(0, 4);
}
