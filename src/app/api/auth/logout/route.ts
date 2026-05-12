import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { endpoints } from "@/lib/api/endpoints";

const REFRESH_TOKEN_COOKIE = "cpm.rt";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (refreshToken) {
    try {
      await fetch(`${env.apiBaseUrl}${endpoints.auth.logout}`, {
        method: "POST",
        headers: { "X-Refresh-Token": refreshToken },
        cache: "no-store",
      });
    } catch {
      // Always clear the cookie even if the backend call fails
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  return response;
}
