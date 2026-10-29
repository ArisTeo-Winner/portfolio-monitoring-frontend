"use client";

import { useCallback, useEffect, useState } from "react";
import { getBanxicoCetesCurveCached } from "@/features/marketdata/api/get-banxico-cetes-curve";
import type { BanxicoCetesCurve } from "@/features/marketdata/api/get-banxico-cetes-curve";
import { ApiError } from "@/lib/api/problem-details";

export function CetesCurveWidget() {
  const [curve, setCurve] = useState<BanxicoCetesCurve | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    getBanxicoCetesCurveCached()
      .then(setCurve)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "No fue posible cargar las tasas CETES.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const plazos = curve ? Object.keys(curve).map(Number).sort((a, b) => a - b) : [];

  return (
    <section className="overflow-hidden rounded-[1.35rem] bg-[#111317] shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
      <div className="border-b border-[#1a1f29] px-5 py-4">
        <p className="text-[0.72rem] font-medium uppercase tracking-[0.22em] text-[#17c784]">
          Tasas CETES vigentes (Banxico)
        </p>
      </div>

      {loading ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="h-8 animate-pulse rounded-[0.6rem] bg-[#0d0f13]" key={index} />
          ))}
        </div>
      ) : null}

      {!loading && error ? (
        <div className="space-y-3 p-5">
          <p className="text-[0.82rem] text-[#8a94a6]">{error}</p>
          <button
            className="rounded-full bg-[#1a2028] px-3.5 py-2 text-[0.78rem] font-semibold text-[#c7cedb] transition hover:text-white"
            onClick={load}
            type="button"
          >
            Reintentar
          </button>
        </div>
      ) : null}

      {!loading && !error && curve ? (
        <table className="w-full text-left text-[0.86rem]">
          <thead>
            <tr className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#71819b]">
              <th className="px-5 py-3">Plazo</th>
              <th className="px-5 py-3 text-right">Tasa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1f29]">
            {plazos.map((plazo) => (
              <tr key={plazo}>
                <td className="px-5 py-3 font-medium text-white">{plazo} dias</td>
                <td className="px-5 py-3 text-right font-semibold text-[#17c784]">{curve[plazo].toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
