import { env } from "@/lib/config/env";
import { endpoints } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/problem-details";
import type { LoginPayload } from "@/features/auth/types/auth.types";

export async function login(payload: LoginPayload): Promise<string> {
  const response = await fetch(`${env.apiBaseUrl}${endpoints.auth.login}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    // Required: the backend sets the HttpOnly refresh-token cookie on this
    // response. Without credentials: "include" the browser discards the cookie.
    credentials: "include",
  });

  const raw = await response.text();
  const body = tryParseJson(raw) as Record<string, unknown> | null;

  if (!response.ok) {
    // Handle 429 Too Many Requests with Retry-After header.
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const wait = retryAfter ? Number(retryAfter) : undefined;
      const message =
        (body?.detail as string) ||
        (body?.title as string) ||
        `Too many login attempts. ${wait ? `Please wait ${wait} seconds.` : "Please try again later."}`;
      throw new ApiError(429, message, body ?? undefined);
    }

    const message =
      (body?.detail as string) || (body?.title as string) || response.statusText || "Login failed";
    throw new ApiError(response.status, message, body ?? undefined);
  }

  if (typeof body?.accessToken !== "string") {
    throw new ApiError(502, "Invalid token response from server");
  }

  return body.accessToken;
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
