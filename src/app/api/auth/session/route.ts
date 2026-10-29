import { NextRequest, NextResponse } from "next/server";
import { REFRESH_TOKEN_COOKIE, refreshCookieOptions } from "@/lib/api/bff-cookies";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }

  const refreshToken =
    typeof body === "object" &&
    body !== null &&
    typeof (body as Record<string, unknown>).refreshToken === "string"
      ? (body as { refreshToken: string }).refreshToken
      : null;

  if (!refreshToken) {
    return NextResponse.json({ detail: "refreshToken is required" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions);

  return response;
}
