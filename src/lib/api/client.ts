import { env, ensureClientRuntimeConfig } from "@/lib/config/env";
import { ApiError, type ProblemDetails } from "@/lib/api/problem-details";
import { endpoints } from "@/lib/api/endpoints";
import { expireSession, persistSession, readSession } from "@/features/auth/lib/session";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
};

// ── Concurrent-refresh queue ──────────────────────────────────────────────────
// Ensures that when multiple 401 responses arrive simultaneously only ONE
// refresh request is issued. All other callers wait in the queue and are
// resolved/rejected once the single refresh attempt completes.

let _isRefreshing = false;
type QueueEntry = { resolve: (ok: boolean) => void };
const _refreshQueue: QueueEntry[] = [];

function enqueueRefresh(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    _refreshQueue.push({ resolve });
  });
}

function flushRefreshQueue(ok: boolean): void {
  _refreshQueue.splice(0).forEach(({ resolve }) => resolve(ok));
}

// ─────────────────────────────────────────────────────────────────────────────

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return doApiRequest<T>(path, options, true);
}

async function doApiRequest<T>(
  path: string,
  options: RequestOptions,
  allowRefresh: boolean,
): Promise<T> {
  ensureClientRuntimeConfig();

  const headers = new Headers(options.headers ?? {});
  const { accessToken } = options.auth ? readSession() : { accessToken: null };

  if (!headers.has("Content-Type") && options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
    // Required: sends the HttpOnly refresh-token cookie on every backend request.
    // Without this the browser silently omits the cookie and silent refresh fails.
    credentials: "include",
  });

  const raw = await response.text();
  const payload = raw ? safeJsonParse(raw) : null;

  if (!response.ok) {
    const protectedUnauthorized = shouldHandleProtectedUnauthorized(response.status, path, options);

    if (protectedUnauthorized && allowRefresh) {
      const refreshed = await tryRefreshSession();
      if (refreshed) {
        return doApiRequest<T>(path, options, false);
      }
    }

    if (protectedUnauthorized) {
      expireSession();
    }

    if (response.status === 403) {
      throw new ApiError(403, "You do not have permission to perform this action.", undefined);
    }

    const problem = isProblemDetails(payload) ? payload : undefined;
    const message = problem?.detail || problem?.title || response.statusText || "Request failed";
    throw new ApiError(response.status, message, problem);
  }

  return payload as T;
}

function shouldHandleProtectedUnauthorized(status: number, path: string, options: RequestOptions) {
  return status === 401 && options.auth === true && !isRefreshExcludedPath(path);
}

function isRefreshExcludedPath(path: string) {
  return (
    path === endpoints.auth.login ||
    path === endpoints.auth.register ||
    path === endpoints.auth.logout ||
    path === endpoints.auth.refresh
  );
}

/**
 * Silent session refresh.
 *
 * Calls the backend directly — NOT the BFF proxy.  The browser automatically
 * includes the HttpOnly refresh-token cookie because of `credentials: "include"`.
 *
 * Concurrent callers: only one refresh request is issued at a time.
 * All others wait in the queue and are resolved once the first call settles.
 */
async function tryRefreshSession(): Promise<boolean> {
  // If a refresh is already in flight, wait for it instead of starting another.
  if (_isRefreshing) {
    return enqueueRefresh();
  }

  _isRefreshing = true;
  try {
    const response = await fetch(`${env.apiBaseUrl}${endpoints.auth.refresh}`, {
      method: "POST",
      cache: "no-store",
      // Critical: the HttpOnly refresh-token cookie must travel to the backend.
      credentials: "include",
    });

    if (!response.ok) {
      flushRefreshQueue(false);
      return false;
    }

    const payload = (await response.json()) as Record<string, unknown>;
    if (typeof payload?.accessToken !== "string") {
      flushRefreshQueue(false);
      return false;
    }

    persistSession(payload.accessToken);
    flushRefreshQueue(true);
    return true;
  } catch {
    flushRefreshQueue(false);
    return false;
  } finally {
    _isRefreshing = false;
  }
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * RFC 9457 Problem Details guard.
 * Requires at least a `status` (number) and one of `title` or `detail` (string).
 */
function isProblemDetails(value: unknown): value is ProblemDetails {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["status"] === "number" &&
    (typeof v["title"] === "string" || typeof v["detail"] === "string")
  );
}
