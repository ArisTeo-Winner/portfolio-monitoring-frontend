import { ApiError } from "@/lib/api/problem-details";
import type { LoginPayload } from "@/features/auth/types/auth.types";

export async function login(payload: LoginPayload): Promise<string> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const raw = await response.text();
  const body = tryParseJson(raw) as Record<string, unknown> | null;

  if (!response.ok) {
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
