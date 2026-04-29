import { env } from "@/lib/config/env";

const UPSTREAM_HEALTH_URL = `${env.apiBaseUrl}/actuator/health`;

export async function GET() {
  const startedAt = Date.now();

  try {
    const response = await fetch(UPSTREAM_HEALTH_URL, {
      headers: { accept: "application/json" },
      cache: "no-store",
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8_000),
    });

    const payload = (await response.json().catch(() => null)) as
      | { groups?: string[]; status?: string }
      | null;

    if (!response.ok) {
      return Response.json(
        {
          durationMs: Date.now() - startedAt,
          groups: Array.isArray(payload?.groups) ? payload.groups : [],
          status: payload?.status ?? "DOWN",
          upstreamStatus: response.status,
        },
        { status: response.status },
      );
    }

    return Response.json({
      durationMs: Date.now() - startedAt,
      groups: Array.isArray(payload?.groups) ? payload.groups : [],
      status: payload?.status ?? "UNKNOWN",
    });
  } catch {
    return Response.json(
      {
        durationMs: Date.now() - startedAt,
        groups: [],
        status: "UNREACHABLE",
      },
      { status: 504 },
    );
  }
}
