import { ApiError, localizedErrorMessage } from "@/lib/api/problem-details";
import type { RegisterPayload, UserResponse } from "@/features/auth/types/auth.types";

export async function registerUser(payload: RegisterPayload) {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const raw = await response.text();
  const body = tryParseJson(raw) as Record<string, unknown> | null;

  if (!response.ok) {
    throw new ApiError(response.status, localizedErrorMessage(response.status), body ?? undefined);
  }

  return body as UserResponse;
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
