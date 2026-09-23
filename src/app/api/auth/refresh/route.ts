import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { endpoints } from "@/lib/api/endpoints";
import {
  REFRESH_TOKEN_COOKIE,
  refreshCookieOptions,
  extractBackendRefreshToken,
  backendRefreshCookieHeader,
} from "@/lib/api/bff-cookies";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json({ detail: "No refresh token" }, { status: 401 });
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${env.apiBaseUrl}${endpoints.auth.refresh}`, {
      method: "POST",
      // The backend reads the refresh token from its `refresh_token` cookie
      // (that's how it set it on login). Replay it as a Cookie; keep the header
      // too in case the backend also accepts it.
      headers: {
        "X-Refresh-Token": refreshToken,
        Cookie: backendRefreshCookieHeader(refreshToken),
      },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ detail: "Authentication service unavailable" }, { status: 503 });
  }

  if (!backendResponse.ok) {
    const response = NextResponse.json({ detail: "Session expired" }, { status: 401 });
    response.cookies.delete(REFRESH_TOKEN_COOKIE);
    return response;
  }

  const raw = await backendResponse.text();
  const payload = tryParseJson(raw);

  // Backend contract: `{ accessToken }` in the body; a rotated refresh token (if
  // any) arrives as an HttpOnly Set-Cookie, never in the body.
  const accessToken = readAccessToken(payload);
  if (!accessToken) {
    return NextResponse.json({ detail: "Invalid token response from server" }, { status: 502 });
  }

  const response = NextResponse.json({ accessToken });

  // If the backend rotated the refresh token, persist the new value; otherwise
  // keep the existing cookie (re-set to refresh its max-age).
  const rotatedRefreshToken = extractBackendRefreshToken(backendResponse) ?? refreshToken;
  response.cookies.set(REFRESH_TOKEN_COOKIE, rotatedRefreshToken, refreshCookieOptions);

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
