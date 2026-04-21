"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Search, Bell, Settings, User, LogOut, Globe, 
  ShieldCheck, ArrowUpRight, Wallet, FileText, Key, Monitor, Moon, Sun, 
  Menu, X
} from 'lucide-react';

import { AddTransactionModal } from "@/components/transactions/add-transaction-modal";
import { logout } from "@/features/auth/api/logout";
import { clearSession, readSession } from "@/features/auth/lib/session";
import { getPortfolio } from "@/features/portfolio/api/get-portfolio";
import { formatSignedCurrency } from "@/lib/utils/format";
import { getMe } from "@/features/users/api/get-me";
import type { UserResponse } from "@/features/users/types/user.types";
import { getPortfolioNavBadge } from "@/lib/navigation/release-badges";

type NavItem = {
  href: string;
  label: string;
  badge?: string;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/portfolio", label: "Portfolio", badge: getPortfolioNavBadge() },
];

export function ProtectedShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [portfolioSummary, setPortfolioSummary] = useState<{
    total: string;
    changeValue: string;
    changePercent: string;
    positive: boolean;
  } | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  
  // Navbar state
  const navRef = useRef<HTMLElement | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<'locale' | 'notifications' | 'settings' | 'profile' | 'search-mobile' | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<UserResponse | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (navRef.current && target instanceof Node && !navRef.current.contains(target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name: 'locale' | 'notifications' | 'settings' | 'profile' | 'search-mobile') => {
    setActiveDropdown((current) => (current === name ? null : name));
  };

  useEffect(() => {
    const session = readSession();
    if (!session?.accessToken) {
      router.replace("/login");
      return;
    }

    setSessionReady(true);
    getMe().then(setUser).catch(console.error);
  }, [router]);

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
    if (!sessionReady) {
      return;
    }

    void refreshPortfolioTotal();
  }, [pathname, refreshPortfolioTotal, sessionReady]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

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

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    const session = readSession();

    try {
      if (session?.refreshToken) {
        await logout(session.refreshToken);
      }
    } catch {
      // Clear local session even if remote logout fails.
    } finally {
      clearSession();
      router.replace("/login");
      router.refresh();
      setLoggingOut(false);
    }
  }

  const displayInitial = user?.firstName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U';
  const displayName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.username || 'Usuario';
  const displayUsername = user?.username || user?.email?.split('@')[0] || 'inv_user';
  const displayEmail = user?.email || 'usuario@correo.com';

  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-[#08090d] text-[#f3f6fb]">
        <div className="mx-auto max-w-[1720px] px-4 py-6 md:px-6 xl:px-8">
          <div className="h-20 animate-pulse rounded-[1.2rem] bg-[#101216] shadow-[0_16px_40px_rgba(0,0,0,0.45)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-50 font-sans selection:bg-emerald-500/30 overflow-x-hidden relative">

      <header ref={navRef} className="sticky top-0 z-40 w-full border-b border-zinc-800/60 bg-[#09090b]/80 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-6">
            <div className="flex items-center gap-2 cursor-pointer group">
              <div className="bg-zinc-50 rounded-full p-1.5 shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 22H22L12 2Z" fill="#09090b"/></svg>
              </div>
              <span className="text-lg font-bold tracking-tight text-zinc-50">TRACKER</span>
            </div>

            <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-zinc-400">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const content = (
                <>
                  <span>{item.label}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#c4cede]">
                      {item.badge}
                    </span>
                  ) : null}
                </>
              );
              return (
                <Link
                  className={`relative flex h-[4.1rem] items-center gap-2 px-4 text-[0.97rem] transition ${
                    active ? "font-semibold text-white" : "font-medium text-[#8a94a6] hover:text-white"
                  }`}
                  href={item.href}
                  key={item.label}
                >
                  {content}
                  <span
                    className={`absolute bottom-[-1px] left-1/2 h-[2px] -translate-x-1/2 rounded-full transition ${
                      active ? "bg-[#17c784]" : "bg-transparent"
                    }`}
                    style={{ width: item.label === "Portfolio" ? 126 : 88 }}
                  />
                </Link>
              );
            })}
          </nav>

          {/* LADO DERECHO: Buscador, Acciones y Perfil */}
          <div className="hidden lg:flex items-center gap-2">
            
            {/* Balance Total */}
            <div className="hidden xl:flex items-center bg-[#121214] border border-zinc-800 rounded-lg p-1 pr-1.5 mr-2">
              <div className="px-3">
                <p className="text-[10px] text-zinc-500 uppercase font-medium">Balance Total</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-zinc-50">{portfolioSummary?.total ?? "$0.00"}</span>
                  <span
                    className={`rounded-[0.72rem] px-2.5 py-[0.42rem] text-[0.7rem] font-semibold whitespace-nowrap ${
                    portfolioSummary?.positive === false ? "bg-[#30171d] text-[#ff5d73]" : "bg-[#103427] text-[#24d58f]"
                  }`}
                  >
                  {portfolioSummary ? `${portfolioSummary.changeValue} ${portfolioSummary.changePercent}` : "+$0.00 +0.00%"}
                  </span>
                </div>
              </div>
              <button
                className="flex h-8 items-center justify-center rounded-md bg-emerald-500 px-3 text-xs font-medium text-zinc-950 hover:bg-emerald-400 transition-all shadow-[0_0_10px_rgba(34,197,94,0.2)]"
                onClick={() => setAddModalOpen(true)}
                type="button"
              >
                + Añadir Activo
              </button>
            </div>

            {/* Buscador Global */}
            <div className="relative mr-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Buscar activos, txs..." 
                className="h-9 w-56 rounded-lg border border-zinc-800 bg-zinc-900/50 pl-9 pr-12 text-sm text-zinc-300 placeholder:text-zinc-500 focus:border-zinc-600 focus:bg-[#09090b] focus:outline-none focus:ring-1 focus:ring-zinc-600 transition-all"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-zinc-800 bg-zinc-900 px-1.5 font-mono text-[10px] font-medium text-zinc-500">
                  Ctrl+K
                </kbd>
              </div>
            </div>

            <div className="h-5 w-px bg-zinc-800 mx-1"></div>

            {/* Selector de Idioma / Moneda */}
            <div className="relative">
              <button 
                onClick={() => toggleDropdown('locale')}
                className={`p-2 rounded-lg transition-colors ${activeDropdown === 'locale' ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900/80'}`}
                title="Idioma y Moneda"
              >
                <Globe className="h-5 w-5" />
              </button>
              {activeDropdown === 'locale' && (
                <div className="absolute right-0 mt-2 w-48 bg-[#121214] border border-zinc-800 rounded-xl shadow-2xl p-2 animate-in slide-in-from-top-2 duration-200">
                  <div className="px-2 py-1.5 text-xs font-bold text-zinc-600 uppercase tracking-wider">Idioma</div>
                  <button className="w-full text-left px-3 py-2 text-sm text-zinc-50 bg-zinc-800/50 rounded-md mb-1">ES Español</button>
                  <button className="w-full text-left px-3 py-2 text-sm text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/50 rounded-md">US English</button>
                  <div className="border-t border-zinc-800/60 my-2"></div>
                  <div className="px-2 py-1.5 text-xs font-bold text-zinc-600 uppercase tracking-wider">Moneda Base</div>
                  <button className="w-full text-left px-3 py-2 text-sm text-zinc-50 bg-zinc-800/50 rounded-md mb-1">USD - Dólar</button>
                  <button className="w-full text-left px-3 py-2 text-sm text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/50 rounded-md">EUR - Euro</button>
                  <button className="w-full text-left px-3 py-2 text-sm text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/50 rounded-md">MXN - Peso Mex</button>
                </div>
              )}
            </div>

            {/* Notificaciones (Campana) */}
            <div className="relative">
              <button 
                onClick={() => toggleDropdown('notifications')}
                className={`p-2 rounded-lg transition-colors relative ${activeDropdown === 'notifications' ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900/80'}`}
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full border border-[#09090b]"></span>
              </button>
              {activeDropdown === 'notifications' && (
                <div className="absolute right-0 mt-2 w-80 bg-[#121214] border border-zinc-800 rounded-xl shadow-2xl py-2 animate-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-zinc-50">Notificaciones</h4>
                    <button className="text-xs font-medium text-emerald-500 hover:text-emerald-400">Marcar leídas</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar">
                    {/* Dummy Notifications */}
                    <div className="px-4 py-3 border-b border-zinc-800/40 hover:bg-zinc-800/30 transition-colors flex gap-3 cursor-pointer">
                      <div className="mt-0.5 bg-zinc-900 p-1.5 rounded-full border border-zinc-800 h-fit">
                        <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-50">Sincronización Exitosa</p>
                        <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">Tus transacciones están al día.</p>
                        <p className="text-[10px] text-zinc-500 mt-1">Hace 2 min</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-2 border-t border-zinc-800/60 text-center">
                    <button className="text-xs font-medium text-zinc-400 hover:text-zinc-50">Ver todas las notificaciones</button>
                  </div>
                </div>
              )}
            </div>

            {/* Engrane (Configuración) */}
            <div className="relative">
              <button 
                onClick={() => toggleDropdown('settings')}
                className={`p-2 rounded-lg transition-colors ${activeDropdown === 'settings' ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-900/80'}`}
                title="Configuración"
              >
                <Settings className="h-5 w-5" />
              </button>
              {activeDropdown === 'settings' && (
                <div className="absolute right-0 mt-2 w-64 bg-[#121214] border border-zinc-800 rounded-xl shadow-2xl py-2 animate-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-2 text-xs font-bold text-zinc-600 uppercase tracking-wider">Preferencias</div>
                  <div className="px-4 py-2 flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Tema Visual</span>
                    <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                      <button className="p-1 rounded-md text-zinc-500 hover:text-zinc-300"><Sun className="h-3.5 w-3.5"/></button>
                      <button className="p-1 rounded-md bg-zinc-800 text-zinc-50 shadow-sm"><Moon className="h-3.5 w-3.5"/></button>
                      <button className="p-1 rounded-md text-zinc-500 hover:text-zinc-300"><Monitor className="h-3.5 w-3.5"/></button>
                    </div>
                  </div>
                  <div className="border-t border-zinc-800/60 my-2"></div>
                  <div className="px-4 py-2 text-xs font-bold text-zinc-600 uppercase tracking-wider">Gestión</div>
                  <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:text-zinc-50 hover:bg-zinc-800/50 transition-colors"><Monitor className="h-4 w-4 text-zinc-400"/> Integraciones Activas</a>
                  <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:text-zinc-50 hover:bg-zinc-800/50 transition-colors"><ShieldCheck className="h-4 w-4 text-zinc-400"/> Seguridad (2FA, Tokens)</a>
                </div>
              )}
            </div>

            {/* Perfil de Usuario */}
            <div className="relative ml-2">
              <button 
                onClick={() => toggleDropdown('profile')}
                className={`flex items-center gap-2 p-1 pl-1.5 pr-3 rounded-full border transition-all ${activeDropdown === 'profile' ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-900/50 hover:bg-zinc-800 border-zinc-800/60 hover:border-zinc-700'}`}
              >
                <div className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-xs font-bold border border-emerald-500/30">
                  {displayInitial}
                </div>
                <div className="flex flex-col items-start hidden xl:flex">
                    <span className="text-xs font-bold text-zinc-200 leading-tight">{displayName}</span>
                    <span className="text-[10px] text-zinc-500 font-mono leading-tight">{displayUsername}</span>
                </div>
              </button>

              {activeDropdown === 'profile' && (
                <div className="absolute right-0 mt-2 w-64 bg-[#121214] border border-zinc-800 rounded-xl shadow-2xl py-2 animate-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-3 border-b border-zinc-800/60 mb-2 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-base font-bold border border-emerald-500/30">
                      {displayInitial}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-50">{displayName}</p>
                      <p className="text-xs text-zinc-500">{displayEmail}</p>
                    </div>
                  </div>
                  
                  <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:text-zinc-50 hover:bg-zinc-800/50 transition-colors">
                    <User className="h-4 w-4 text-zinc-400" /> Resumen de Cuenta
                  </a>
                  <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:text-zinc-50 hover:bg-zinc-800/50 transition-colors">
                    <Wallet className="h-4 w-4 text-zinc-400" /> Mis Carteras
                  </a>
                  <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:text-zinc-50 hover:bg-zinc-800/50 transition-colors">
                    <FileText className="h-4 w-4 text-zinc-400" /> Importar CSV
                  </a>
                  <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:text-zinc-50 hover:bg-zinc-800/50 transition-colors">
                    <Key className="h-4 w-4 text-zinc-400" /> API Keys de Lectura
                  </a>
                  
                  <div className="border-t border-zinc-800/60 my-2"></div>
                  <button 
                    disabled={loggingOut}
                    onClick={() => { setActiveDropdown(null); void handleLogout(); }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-500 hover:bg-rose-500/10 transition-colors font-medium cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" /> {loggingOut ? "Cerrando..." : "Cerrar sesión"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* VISTA MOBILE */}
          <div className="lg:hidden flex items-center gap-2">
            <button
              className="rounded-[0.95rem] bg-[#0e7a4f] px-3 py-2 text-[0.84rem] font-semibold text-white shadow-[0_14px_30px_rgba(14,122,79,0.28)] transition hover:bg-[#11945f]"
              onClick={() => setAddModalOpen(true)}
              type="button"
            >
              + Activo
            </button>
            <div className="flex items-center gap-1">
              <button onClick={() => toggleDropdown('search-mobile')} className="p-2 text-zinc-400 hover:text-zinc-50 transition-colors">
                <Search className="h-5 w-5" />
              </button>
              <button 
                onClick={() => toggleDropdown('notifications')}
                className="p-2 text-zinc-400 hover:text-zinc-50 transition-colors relative"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-emerald-500 rounded-full border border-[#09090b]"></span>
              </button>
              <div className="h-5 w-px bg-zinc-800 mx-1"></div>
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`p-2 rounded-lg transition-colors ${isMobileMenuOpen ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:text-zinc-50'}`}
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* --- DESPLEGABLES MOVILES --- */}
        {activeDropdown === 'search-mobile' && (
          <div className="lg:hidden absolute top-16 left-0 w-full bg-[#09090b] border-b border-zinc-800 p-4 shadow-2xl animate-in slide-in-from-top-2 duration-200">
             <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input 
                autoFocus
                type="text" 
                placeholder="Buscar activos, transacciones..." 
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="h-10 w-full rounded-lg border border-emerald-500/50 bg-[#121214] pl-10 pr-4 text-sm text-zinc-50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>
          </div>
        )}

        {/* Dropdown Notificaciones Movil */}
        {activeDropdown === 'notifications' && (
          <div className="lg:hidden absolute top-16 left-0 w-full bg-[#09090b] border-b border-zinc-800 p-4 shadow-2xl animate-in slide-in-from-top-2 duration-200">
             <h4 className="text-sm font-bold text-zinc-50 mb-3">Notificaciones</h4>
             <div className="px-4 py-3 border border-zinc-800/40 bg-[#121214] rounded-lg flex gap-3">
                <div className="mt-0.5 bg-zinc-900 p-1.5 rounded-full border border-zinc-800 h-fit">
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-50">Sincronización Exitosa</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Tus transacciones están al día.</p>
                </div>
              </div>
          </div>
        )}

        {/* Menu Principal Movil */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-16 left-0 w-full h-[calc(100vh-64px)] bg-[#09090b] border-t border-zinc-800/60 flex flex-col overflow-y-auto animate-in slide-in-from-top-4 duration-300">
            <div className="p-6 pb-2 border-b border-zinc-800/40">
               <p className="text-xs text-zinc-500 uppercase font-medium mb-2">Balance Total</p>
               <div className="flex items-center gap-3">
                  <span className="font-mono text-xl font-medium text-zinc-50">{portfolioSummary?.total ?? "$0.00"}</span>
                  <span
                    className={`rounded-[0.72rem] px-2.5 py-[0.42rem] text-[0.7rem] font-semibold whitespace-nowrap ${
                    portfolioSummary?.positive === false ? "bg-[#30171d] text-[#ff5d73]" : "bg-[#103427] text-[#24d58f]"
                  }`}
                  >
                  {portfolioSummary ? `${portfolioSummary.changeValue} ${portfolioSummary.changePercent}` : "+$0.00 +0.00%"}
                  </span>
               </div>
            </div>
            <div className="flex-1 px-6 py-4 space-y-4">
              <nav className="flex flex-col gap-4 text-base font-medium">
                {navItems.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="border-b border-zinc-800/60 pb-3 text-zinc-400 transition-colors hover:text-zinc-50"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="bg-[#121214] p-4 rounded-xl border border-zinc-800">
                  <p className="text-xs font-bold text-zinc-600 uppercase mb-2">Moneda Base</p>
                  <select className="w-full bg-transparent text-sm text-zinc-50 focus:outline-none">
                    <option>USD - Dólar</option>
                    <option>EUR - Euro</option>
                    <option>MXN - Peso</option>
                  </select>
                </div>
                <div className="bg-[#121214] p-4 rounded-xl border border-zinc-800">
                  <p className="text-xs font-bold text-zinc-600 uppercase mb-2">Tema</p>
                  <select className="w-full bg-transparent text-sm text-zinc-50 focus:outline-none">
                    <option>Oscuro</option>
                    <option>Claro</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 bg-[#121214] border-t border-zinc-800/60 mt-auto">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-lg font-bold border border-emerald-500/30">
                    {displayInitial}
                  </div>
                  <div>
                    <p className="text-base font-bold text-zinc-50">{displayName}</p>
                    <p className="text-sm text-zinc-500 font-mono">{displayUsername}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded-lg text-sm font-medium text-zinc-300 transition-colors">
                    <Settings className="h-4 w-4"/> Config.
                  </button>
                  <button onClick={() => { setIsMobileMenuOpen(false); void handleLogout(); }} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-lg text-sm font-medium transition-colors">
                    <LogOut className="h-4 w-4"/> Salir
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="mx-auto max-w-[1720px] px-4 py-6 md:px-6 xl:px-8">{children}</div>

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

function formatHeaderCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}
