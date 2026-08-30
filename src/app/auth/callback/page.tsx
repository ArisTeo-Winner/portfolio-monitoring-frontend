"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { persistSession } from "@/features/auth/lib/session";
import { verifyAndConsumeOAuthState } from "@/features/auth/lib/oauth-state";
import { ensureClientRuntimeConfig } from "@/lib/config/env";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const message = useMemo(
    () => error ?? "Completing Google sign-in and securing your workspace...",
    [error],
  );

  useEffect(() => {
    let cancelled = false;

    async function processCallback() {
      try {
        ensureClientRuntimeConfig();

        const raw = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const params = new URLSearchParams(raw);
        const accessToken = params.get("accessToken");
        const refreshToken = params.get("refreshToken");
        // The OAuth `state` nonce may arrive in the fragment or the query string.
        const state =
          params.get("state") ?? new URLSearchParams(window.location.search).get("state");

        // Remove tokens from the URL immediately so they don't persist in
        // browser history or appear in the address bar after this point.
        history.replaceState(null, "", window.location.pathname + window.location.search);

        // Bind the flow to this browser: reject unless a nonce was stored by
        // startGoogleLogin() in this tab (and, when the backend echoes state,
        // unless it matches). This blocks a crafted /auth/callback# link from
        // fixating an attacker-controlled session in the victim's browser. The
        // nonce is consumed here (one-time use) before any token is trusted.
        if (!verifyAndConsumeOAuthState(state)) {
          if (!cancelled)
            setError("This Google sign-in could not be verified. Please start the sign-in again.");
          return;
        }

        if (!accessToken || !refreshToken) {
          if (!cancelled) setError("Google login returned without tokens. Please retry the sign-in flow.");
          return;
        }

        // Exchange the refresh token for an HttpOnly cookie via the BFF.
        // This is the only moment the raw refresh token is visible to JS.
        const sessionRes = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
          cache: "no-store",
        });

        if (!sessionRes.ok) {
          if (!cancelled) setError("Failed to secure your session. Please try again.");
          return;
        }

        if (cancelled) return;
        persistSession(accessToken);
        router.replace("/portfolio");
        router.refresh();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Google login failed because the frontend runtime config is invalid.",
          );
        }
      }
    }

    void processCallback();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="hero-grid flex min-h-screen items-center justify-center px-6 py-12">
      <section className="flex flex-col items-center rounded-[2rem] border border-zinc-800/80 bg-[#121214]/95 backdrop-blur-xl px-10 py-14 text-center shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)]">
        <p className="mb-4 text-xs font-bold tracking-[0.25em] text-emerald-500 uppercase">OAuth2 callback</p>
        <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-zinc-50">
          {error ? "Google login failed" : "Signing you in"}
        </h1>
        <p className="mb-10 text-sm leading-relaxed text-zinc-400 max-w-[320px] mx-auto">{message}</p>
        {error ? (
          <div className="flex items-center justify-center gap-3">
            <Link
              className="inline-flex rounded-full bg-[#17c784] px-6 py-3 text-sm font-semibold text-white"
              href="/login"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <div className="relative flex h-3 w-3 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
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
