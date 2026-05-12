import { env, ensureClientRuntimeConfig } from "@/lib/config/env";
import { ApiError, type ProblemDetails } from "@/lib/api/problem-details";
import { endpoints } from "@/lib/api/endpoints";
import { expireSession, persistSession, readSession } from "@/features/auth/lib/session";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
};

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

async function tryRefreshSession(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      cache: "no-store",
    });

    if (!response.ok) return false;

    const payload = await response.json() as Record<string, unknown>;
    if (typeof payload?.accessToken !== "string") return false;

    persistSession(payload.accessToken as string);
    return true;
  } catch {
    return false;
  }
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  return typeof value === "object" && value !== null;
}
