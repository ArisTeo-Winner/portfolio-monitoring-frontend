import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { endpoints } from "@/lib/api/endpoints";
import {
  REFRESH_TOKEN_COOKIE,
  refreshCookieOptions,
  extractBackendRefreshToken,
} from "@/lib/api/bff-cookies";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${env.apiBaseUrl}${endpoints.auth.login}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ detail: "Authentication service unavailable" }, { status: 503 });
  }

  const raw = await backendResponse.text();
  const payload = tryParseJson(raw);

  if (!backendResponse.ok) {
    const forwarded = NextResponse.json(payload ?? { detail: backendResponse.statusText }, {
      status: backendResponse.status,
    });
    // Preserve rate-limit UX: surface the backend's Retry-After to the client.
    const retryAfter = backendResponse.headers.get("Retry-After");
    if (retryAfter) {
      forwarded.headers.set("Retry-After", retryAfter);
    }
    return forwarded;
  }

  // Backend contract: `{ accessToken }` in the body; the refresh token is
  // delivered ONLY as an HttpOnly Set-Cookie header, never in the body.
  const accessToken = readAccessToken(payload);
  if (!accessToken) {
    return NextResponse.json({ detail: "Invalid token response from server" }, { status: 502 });
  }

  const refreshToken = extractBackendRefreshToken(backendResponse);
  if (!refreshToken) {
    return NextResponse.json({ detail: "Invalid token response from server" }, { status: 502 });
  }

  // Re-issue the backend's refresh token as our own first-party HttpOnly cookie
  // on the app origin. The browser only ever receives `{ accessToken }`.
  const response = NextResponse.json({ accessToken });
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions);
  return response;
}

function readAccessToken(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const value = (payload as Record<string, unknown>).accessToken;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
