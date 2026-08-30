import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";

// { "28": 6.18, "91": 6.49, ... } — plazo en dias -> tasa anualizada %.
export type BanxicoCetesCurve = Record<number, number>;

type RawBanxicoCetesCurve = Record<string, number>;

export async function getBanxicoCetesCurve(): Promise<BanxicoCetesCurve> {
  const response = await apiRequest<RawBanxicoCetesCurve>(endpoints.marketdata.banxicoCetesCurve, {
    auth: true,
  });

  const curve: BanxicoCetesCurve = {};
  for (const [plazo, tasa] of Object.entries(response)) {
    const plazoDias = Number(plazo);
    if (Number.isFinite(plazoDias)) {
      curve[plazoDias] = tasa;
    }
  }
  return curve;
}

// Banxico publishes CETES auction results weekly — a short-lived in-memory
// cache avoids refetching on every mount (curve widget, bond purchase form).
const CETES_CURVE_CACHE_TTL_MS = 60 * 60 * 1000;

let cetesCurveCache: BanxicoCetesCurve | null = null;
let cetesCurveCacheAt = 0;
let cetesCurveInFlight: Promise<BanxicoCetesCurve> | null = null;

export async function getBanxicoCetesCurveCached(): Promise<BanxicoCetesCurve> {
  const now = Date.now();

  if (cetesCurveCache && now - cetesCurveCacheAt < CETES_CURVE_CACHE_TTL_MS) {
    return cetesCurveCache;
  }

  if (cetesCurveInFlight) {
    return cetesCurveInFlight;
  }

  const request = getBanxicoCetesCurve()
    .then((data) => {
      cetesCurveCache = data;
      cetesCurveCacheAt = Date.now();
      return data;
    })
    .finally(() => {
      cetesCurveInFlight = null;
    });

  cetesCurveInFlight = request;
  return request;
}
