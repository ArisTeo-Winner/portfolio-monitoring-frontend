"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { persistSession } from "@/features/auth/lib/session";
import type { JwtResponse } from "@/features/auth/types/auth.types";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const message = useMemo(
    () => error ?? "Completing Google sign-in and securing your workspace...",
    [error],
  );

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");

    if (!accessToken || !refreshToken) {
      setError("Google login returned without JWT tokens. Retry the sign-in flow.");
      return;
    }

    const tokens: JwtResponse = { accessToken, refreshToken };
    persistSession(tokens);
    router.replace("/portfolio");
    router.refresh();
  }, [router]);

  return (
    <main className="hero-grid flex min-h-screen items-center justify-center px-6 py-12">
      <section className="flex flex-col items-center rounded-[2rem] border border-zinc-800/80 bg-[#121214]/95 backdrop-blur-xl px-10 py-14 text-center shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]">
        <p className="mb-4 text-xs font-bold tracking-[0.25em] text-emerald-500 uppercase">OAuth2 callback</p>
        <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-zinc-50">{error ? "Google login failed" : "Signing you in"}</h1>
        <p className="mb-10 text-sm leading-relaxed text-zinc-400 max-w-[320px] mx-auto">{message}</p>
        {error ? (
          <div className="flex items-center justify-center gap-3">
            <Link className="inline-flex rounded-full bg-[#17c784] px-6 py-3 text-sm font-semibold text-white" href="/login">
              Back to login
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <div className="relative flex h-3 w-3 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </div>
            <span className="text-sm font-medium text-zinc-400">
            Redirecting to portfolio...
            </span>
          </div>
        )}
      </section>
    </main>
  );
}
