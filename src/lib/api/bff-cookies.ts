/**
 * Server-only helpers shared by the BFF auth route handlers
 * (`src/app/api/auth/*`).
 *
 * Contract with the Spring Boot backend (confirmed against the live API):
 *  - POST /api/v1/auth/login responds with `{ accessToken }` in the body and
 *    delivers the refresh token ONLY as an HttpOnly `Set-Cookie` header — never
 *    in the JSON body.
 *
 * The BFF captures that refresh token from the backend response and re-issues it
 * as its OWN first-party HttpOnly cookie (`cpm.rt`) on the app origin, so the
 * browser never sees the raw refresh token and never talks to the backend origin
 * directly. On refresh/logout the BFF replays `cpm.rt` to the backend via the
 * `X-Refresh-Token` header.
 */

/** First-party refresh-token cookie name, set on the app origin by the BFF. */
export const REFRESH_TOKEN_COOKIE = "cpm.rt";

/**
 * Name of the cookie the BACKEND uses for the refresh token (confirmed:
 * `refresh_token`). The backend's /tokens/refresh and /auth/logout read the
 * refresh token from THIS cookie, so the BFF must replay it under this name.
 * Overridable via `BACKEND_REFRESH_COOKIE`.
 */
export function backendRefreshCookieName(): string {
  return process.env.BACKEND_REFRESH_COOKIE?.trim() || "refresh_token";
}

/**
 * Build the `Cookie` header value that hands the refresh token to the backend
 * the way it set it (a cookie), e.g. `refresh_token=<value>`.
 */
export function backendRefreshCookieHeader(refreshToken: string): string {
  return `${backendRefreshCookieName()}=${refreshToken}`;
}

/** 30 days, in seconds. */
export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Options for the first-party refresh cookie (single source of truth). */
export const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: REFRESH_COOKIE_MAX_AGE,
  path: "/",
} as const;

type ParsedCookie = { name: string; value: string };

function readSetCookies(response: Response): string[] {
  // Node's undici (Next.js server runtime) exposes getSetCookie(); fall back to
  // the single-header accessor for other runtimes.
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function parseCookiePairs(rawCookies: string[]): ParsedCookie[] {
  return rawCookies
    .map((cookie) => {
      const firstPair = cookie.split(";", 1)[0] ?? "";
      const eq = firstPair.indexOf("=");
      if (eq === -1) return null;
      const name = firstPair.slice(0, eq).trim();
      const value = firstPair.slice(eq + 1).trim();
      return name && value ? { name, value } : null;
    })
    .filter((entry): entry is ParsedCookie => entry !== null);
}

/**
 * Extract the backend's refresh-token value from a backend response's
 * `Set-Cookie` header(s).
 *
 * Selection strategy (robust to not knowing the exact backend cookie name):
 *  1. If `BACKEND_REFRESH_COOKIE` env is set, match that exact name.
 *  2. Otherwise, if the backend sets exactly one cookie, use it.
 *  3. Otherwise, pick the first cookie whose name looks like a refresh token
 *     (contains "refresh", or an "rt" token bounded by separators/edges).
 *
 * Returns `null` when no refresh cookie can be identified — callers treat that
 * as a broken contract (502).
 */
export function extractBackendRefreshToken(response: Response): string | null {
  const cookies = parseCookiePairs(readSetCookies(response));
  if (cookies.length === 0) return null;

  const configuredName = process.env.BACKEND_REFRESH_COOKIE?.trim();
  if (configuredName) {
    const match = cookies.find((cookie) => cookie.name === configuredName);
    return match?.value ?? null;
  }

  if (cookies.length === 1) {
    return cookies[0].value;
  }

  const heuristic = cookies.find((cookie) => /refresh|(^|[._-])rt($|[._-])/i.test(cookie.name));
  return heuristic?.value ?? null;
}
