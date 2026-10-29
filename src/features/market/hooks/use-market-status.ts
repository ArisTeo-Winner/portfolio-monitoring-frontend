"use client";

import { useEffect, useReducer } from "react";
import { getMarketStatus } from "@/features/market/api/get-market-status";
import { computeAllMarkets } from "@/features/market/lib/market-calendar";
import { ApiError } from "@/lib/api/problem-details";
import type { MarketCode, MarketStatus } from "@/features/market/types/market-status.types";

export type MarketStatusSource = "live" | "fallback";

export type MarketStatusState = {
  markets: MarketStatus[];
  source: MarketStatusSource;
  asOf: string | null;
};

// ── Shared store ──────────────────────────────────────────────────────────────
// A single poll loop feeds every consumer (header chip + N contextual anchors), so
// we never run N fetch loops. The endpoint is the primary source; the pure
// client-side calendar is the fallback for 429 / network failures (errors swallowed
// so the header never breaks). The loop runs only while something is subscribed.

const BASE_DELAY_MS = 30_000; // matches the endpoint's Cache-Control: max-age=30
const MAX_DELAY_MS = 120_000;

let state: MarketStatusState = { markets: computeAllMarkets(), source: "fallback", asOf: null };
const subscribers = new Set<() => void>();

let started = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let controller: AbortController | null = null;
let delay = BASE_DELAY_MS;

function emit() {
  subscribers.forEach((fn) => fn());
}

function setFallback() {
  state = { markets: computeAllMarkets(), source: "fallback", asOf: null };
  emit();
}

async function runOnce() {
  controller = new AbortController();
  try {
    const res = await getMarketStatus(controller.signal);
    state = { markets: res.markets, source: "live", asOf: res.asOf };
    delay = BASE_DELAY_MS;
    emit();
  } catch (error) {
    // AbortError (unmount) or a real failure — degrade to the local calculation.
    // 429 → back off (the endpoint sends Retry-After; we approximate with exponential
    // backoff capped at MAX_DELAY_MS since apiRequest doesn't surface headers).
    const status = error instanceof ApiError ? error.status : 0;
    delay = status === 429 ? Math.min(delay * 2, MAX_DELAY_MS) : BASE_DELAY_MS;
    setFallback();
  } finally {
    if (started) timer = setTimeout(runOnce, delay);
  }
}

function start() {
  if (started) return;
  started = true;
  delay = BASE_DELAY_MS;
  void runOnce();
}

function stop() {
  started = false;
  if (timer) clearTimeout(timer);
  timer = null;
  controller?.abort();
  controller = null;
}

/** Test-only: reset the shared store between cases. */
export function __resetMarketStatusStore() {
  stop();
  state = { markets: computeAllMarkets(), source: "fallback", asOf: null };
  subscribers.clear();
}

export function useMarketStatus(): MarketStatusState {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    subscribers.add(force);
    start();
    return () => {
      subscribers.delete(force);
      if (subscribers.size === 0) stop();
    };
  }, []);
  return state;
}

export function findMarket(markets: MarketStatus[], code: MarketCode): MarketStatus | undefined {
  return markets.find((m) => m.code === code);
}
