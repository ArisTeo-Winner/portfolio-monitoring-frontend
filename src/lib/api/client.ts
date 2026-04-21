import { env } from "@/lib/config/env";
import { ApiError, type ProblemDetails } from "@/lib/api/problem-details";
import { endpoints } from "@/lib/api/endpoints";
import { expireSession, persistSession, readSession } from "@/features/auth/lib/session";
import type { JwtResponse } from "@/features/auth/types/auth.types";

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
  const headers = new Headers(options.headers ?? {});
  const session = options.auth ? readSession() : null;

  if (!headers.has("Content-Type") && options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
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
    const refreshToken = session?.refreshToken;
    const protectedUnauthorized = shouldHandleProtectedUnauthorized(response.status, path, options);

    if (protectedUnauthorized && refreshToken && allowRefresh) {
      const refreshed = await tryRefreshSession(refreshToken);

      if (refreshed) {
        return doApiRequest<T>(path, options, false);
      }
    }

    if (protectedUnauthorized) {
      expireSession();
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

async function tryRefreshSession(refreshToken: string): Promise<boolean> {
  const response = await fetch(`${env.apiBaseUrl}${endpoints.auth.refresh}`, {
    method: "POST",
    headers: {
      "X-Refresh-Token": refreshToken,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return false;
  }

  const raw = await response.text();
  const payload = raw ? safeJsonParse(raw) : null;

  if (!isJwtResponse(payload)) {
    return false;
  }

  persistSession(payload);
  return true;
}

function isJwtResponse(value: unknown): value is JwtResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as JwtResponse).accessToken === "string" &&
    typeof (value as JwtResponse).refreshToken === "string"
  );
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
