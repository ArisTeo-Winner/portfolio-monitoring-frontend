function resolveApiOrigin(): string {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

  try {
    return new URL(configuredBaseUrl).origin;
  } catch {
    return "http://localhost:8080";
  }
}

/**
 * Builds the Content-Security-Policy value for a single request.
 *
 * `script-src` carries a per-request nonce instead of 'unsafe-inline' so only
 * Next.js's own inline hydration scripts (stamped with the same nonce) may run —
 * an injected inline script has no matching nonce and is blocked. The nonce is
 * minted per request in `src/middleware.ts`; a static build-time header cannot
 * carry one, which is why this is generated at request time.
 */
export function buildContentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const scriptSources = ["'self'", `'nonce-${nonce}'`];
  // CoinGecko/CoinMarketCap must always be called server-side (Route Handlers),
  // never fetched directly from the browser — keeps connect-src minimal so a
  // compromised frontend has no whitelisted exfiltration destination.
  const connectSources = ["'self'", resolveApiOrigin()];

  if (isDevelopment) {
    scriptSources.push("'unsafe-eval'");
    connectSources.push("ws:", "wss:");
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    `connect-src ${connectSources.join(" ")}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
