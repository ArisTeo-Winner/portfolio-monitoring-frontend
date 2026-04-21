const HOLDING_DETAIL_TRACE_KEY = "holding-detail:navigation-trace";

type HoldingDetailTrace = {
  symbol: string;
  startedAt: number;
  wallClockStartedAt: number;
};

export function startHoldingDetailTrace(symbol: string) {
  if (typeof window === "undefined") return;

  const trace: HoldingDetailTrace = {
    symbol: symbol.toUpperCase(),
    startedAt: window.performance.now(),
    wallClockStartedAt: Date.now(),
  };

  window.sessionStorage.setItem(HOLDING_DETAIL_TRACE_KEY, JSON.stringify(trace));
}

export function readHoldingDetailTrace(symbol: string) {
  if (typeof window === "undefined") return null;

  const rawTrace = window.sessionStorage.getItem(HOLDING_DETAIL_TRACE_KEY);
  if (!rawTrace) return null;

  try {
    const trace = JSON.parse(rawTrace) as HoldingDetailTrace;
    if (trace.symbol !== symbol.toUpperCase()) return null;
    return trace;
  } catch {
    return null;
  }
}

export function clearHoldingDetailTrace() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(HOLDING_DETAIL_TRACE_KEY);
}

export function markHoldingDetailPerformance(markName: string) {
  if (typeof window === "undefined") return;
  window.performance.mark(markName);
}

export function measureHoldingDetailPerformance(
  measureName: string,
  startMark: string,
  endMark: string,
) {
  if (typeof window === "undefined") return null;

  try {
    window.performance.measure(measureName, startMark, endMark);
    const [entry] = window.performance.getEntriesByName(measureName, "measure");
    return entry?.duration ?? null;
  } catch {
    return null;
  }
}

export function clearHoldingDetailPerformance(measureNames: string[], markNames: string[]) {
  if (typeof window === "undefined") return;

  measureNames.forEach((measureName) => window.performance.clearMeasures(measureName));
  markNames.forEach((markName) => window.performance.clearMarks(markName));
}
