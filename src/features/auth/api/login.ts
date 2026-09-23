import { endpoints } from "@/lib/api/endpoints";
import { ApiError, localizedErrorMessage } from "@/lib/api/problem-details";
import type { LoginPayload } from "@/features/auth/types/auth.types";

export async function login(payload: LoginPayload): Promise<string> {
  // Login goes through the first-party BFF (same-origin), NOT the backend
  // directly. The BFF forwards credentials to the backend, captures the
  // HttpOnly refresh cookie, and re-issues it as `cpm.rt` on the app origin —
  // so the browser only ever receives `{ accessToken }`.
  const response = await fetch(endpoints.bff.login, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    credentials: "same-origin",
  });

  const raw = await response.text();
  const body = tryParseJson(raw) as Record<string, unknown> | null;

  if (!response.ok) {
    // Handle 429 Too Many Requests with Retry-After header (forwarded by the BFF).
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const wait = retryAfter ? Number(retryAfter) : undefined;
      const message = wait
        ? `Demasiados intentos. Espera ${wait} segundos e intenta de nuevo.`
        : localizedErrorMessage(429);
      throw new ApiError(429, message, body ?? undefined);
    }

    throw new ApiError(response.status, localizedErrorMessage(response.status), body ?? undefined);
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
