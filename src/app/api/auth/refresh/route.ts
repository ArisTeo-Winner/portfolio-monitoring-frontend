import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { endpoints } from "@/lib/api/endpoints";

const REFRESH_TOKEN_COOKIE = "cpm.rt";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json({ detail: "No refresh token" }, { status: 401 });
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${env.apiBaseUrl}${endpoints.auth.refresh}`, {
      method: "POST",
      headers: { "X-Refresh-Token": refreshToken },
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

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as Record<string, unknown>).accessToken !== "string" ||
    typeof (payload as Record<string, unknown>).refreshToken !== "string"
  ) {
    return NextResponse.json({ detail: "Invalid token response from server" }, { status: 502 });
  }

  const { accessToken, refreshToken: newRefreshToken } = payload as {
    accessToken: string;
    refreshToken: string;
  };

  const response = NextResponse.json({ accessToken });
  response.cookies.set(REFRESH_TOKEN_COOKIE, newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return response;
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
