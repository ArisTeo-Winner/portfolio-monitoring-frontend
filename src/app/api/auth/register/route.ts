import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { endpoints } from "@/lib/api/endpoints";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${env.apiBaseUrl}${endpoints.auth.register}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ detail: "Registration service unavailable" }, { status: 503 });
  }

  const raw = await backendResponse.text();
  const payload = tryParseJson(raw);

  if (!backendResponse.ok) {
    return NextResponse.json(payload ?? { detail: backendResponse.statusText }, {
      status: backendResponse.status,
    });
  }

  return NextResponse.json(payload ?? {}, { status: backendResponse.status });
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
