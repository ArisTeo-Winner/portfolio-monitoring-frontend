import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { endpoints } from "@/lib/api/endpoints";

const REFRESH_TOKEN_COOKIE = "cpm.rt";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

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
    return NextResponse.json(payload ?? { detail: backendResponse.statusText }, {
      status: backendResponse.status,
    });
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as Record<string, unknown>).accessToken !== "string" ||
    typeof (payload as Record<string, unknown>).refreshToken !== "string"
  ) {
    return NextResponse.json({ detail: "Invalid token response from server" }, { status: 502 });
  }

  const { accessToken, refreshToken } = payload as { accessToken: string; refreshToken: string };

  const response = NextResponse.json({ accessToken });
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
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
