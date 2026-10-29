"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/auth/auth-dialog";

type Mode = "login" | "register";

type Props = {
  initialMode: Mode;
  openOnLoad?: boolean;
};

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  OIDC_LOGIN_FAILED: "No fue posible completar el acceso con Google.",
  OAUTH2_PRINCIPAL_INVALID: "La sesión de Google no pudo vincularse a una cuenta válida.",
  OAUTH2_TOKEN_ISSUE_FAILED: "Google autenticó la cuenta, pero el backend no pudo emitir los tokens.",
};

export function AuthExperience({ initialMode, openOnLoad = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [open, setOpen] = useState(openOnLoad);
  const [prefilledEmail, setPrefilledEmail] = useState("");
  const isStandaloneAuthRoute = pathname === "/login" || pathname === "/register";

  const oauthError = searchParams.get("oauth_error");
  const sessionExpired = searchParams.get("session_expired");
  const oauthErrorMessage = oauthError
    ? (OAUTH_ERROR_MESSAGES[oauthError] ?? "No fue posible completar el acceso social.")
    : null;
  const sessionExpiredMessage = sessionExpired
    ? "Tu sesión expiró o ya no pudo renovarse. Inicia sesión de nuevo para continuar."
    : null;
  const authMessage = sessionExpiredMessage ?? oauthErrorMessage;

  const headline = useMemo(
    () =>
      mode === "login"
        ? "Track your crypto portfolio with a dedicated, secure workspace."
        : "Create your account and start monitoring performance, allocation and transactions.",
    [mode],
  );

  useEffect(() => {
    if (!openOnLoad) {
      return;
    }
    setOpen(true);
  }, [openOnLoad, oauthError, sessionExpired]);

  function handleClose() {
    if (isStandaloneAuthRoute) {
      router.push("/");
      return;
    }
    setOpen(false);
  }

  function handleRegistered(email: string) {
    setPrefilledEmail(email);
    setMode("login");
  }

  return (
    <main className="hero-grid relative min-h-screen overflow-hidden">
      <div className="absolute left-[8%] top-[12%] h-48 w-48 rounded-full bg-[rgba(53,89,232,0.18)] blur-3xl" />
      <div className="absolute bottom-[8%] right-[10%] h-56 w-56 rounded-full bg-[rgba(30,198,182,0.18)] blur-3xl" />

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col justify-between px-6 py-8 md:px-10">
        <header className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand)] text-lg font-bold text-white">
              CM
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Crypto Portfolio</p>
              <p className="text-lg font-semibold text-slate-900">Monitoring</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => { setMode("login"); setOpen(true); }} type="button" variant="outline">
              Log In
            </Button>
            <Button onClick={() => { setMode("register"); setOpen(true); }} type="button">
              Sign Up
            </Button>
          </div>
        </header>

        <section className="grid gap-12 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="max-w-3xl space-y-8">
            <div className="space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand)]">Sign up today</p>
              <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight text-slate-950 md:text-7xl">
                Crypto Portfolio Tracker
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">{headline}</p>
            </div>

            <div className="flex flex-wrap gap-4">
              <Button onClick={() => { setMode("register"); setOpen(true); }} type="button">
                Create your portfolio
              </Button>
              <Button onClick={() => { setMode("login"); setOpen(true); }} type="button" variant="secondary">
                Log In
              </Button>
            </div>

            <div className="glass grid max-w-3xl gap-4 rounded-[2rem] p-6 md:grid-cols-3 shadow-[0_20px_48px_rgba(15,23,42,0.08)]">
              <StatCard label="Live Tracking" value="24/7" description="Track holdings, transactions and valuation in one place." />
              <StatCard label="Secure Auth" value="JWT + OAuth2" description="Email/password and Google login on the same access layer." />
              <StatCard label="Fast Entry" value="One modal" description="Designed to support the Add Transaction flow next." />
            </div>
          </div>

          <div className="relative hidden h-[540px] lg:block">
            <div className="glass absolute left-0 top-10 w-[290px] rounded-[2rem] p-5">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Portfolio value</p>
                  <p className="text-3xl font-bold text-slate-950">$98,507.14</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">+4.51%</span>
              </div>
              <div className="space-y-3">
                <MiniRow label="Bitcoin" value="$46,452.44" />
                <MiniRow label="Ethereum" value="$45,988.00" />
                <MiniRow label="USDC" value="$6,066.70" />
              </div>
            </div>
            <div className="glass absolute bottom-0 right-0 w-[330px] rounded-[2rem] p-6">
              <p className="text-sm text-slate-500">Why this frontend split matters</p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">Independent frontend, clean backend boundary.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                This workspace now has a dedicated UI layer ready to connect directly to the Spring Boot API without mixing build pipelines.
              </p>
            </div>
          </div>
        </section>
      </div>

      <AuthDialog
        mode={mode}
        oauthErrorMessage={authMessage}
        onClose={handleClose}
        onModeChange={setMode}
        onRegistered={handleRegistered}
        open={open}
        prefilledEmail={prefilledEmail}
      />
    </main>
  );
}

function StatCard({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="rounded-[1.5rem] bg-white/76 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-slate-50/90 px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-950">{value}</span>
    </div>
  );
}
