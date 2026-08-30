"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getCetesMarkToMarket } from "@/features/portfolio/api/get-cetes-mark-to-market";
import type { MarkToMarketResponse } from "@/features/portfolio/types/cetes.types";
import { ApiError } from "@/lib/api/problem-details";
import { formatCurrencyByCode } from "@/lib/utils/currency";

type CetesMarkToMarketCardProps = {
  transactionId: string;
  assetName: string;
  maturityDate?: string;
};

export function CetesMarkToMarketCard({ transactionId, assetName, maturityDate }: CetesMarkToMarketCardProps) {
  const [data, setData] = useState<MarkToMarketResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getCetesMarkToMarket(transactionId)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : "No fue posible cargar la valuación a mercado.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [transactionId]);

  if (loading) return <CardShell><Skeleton /></CardShell>;
  if (error) return <CardShell><ErrorState message={error} /></CardShell>;
  if (!data) return null;

  if (data.vencida) {
    return (
      <CardShell>
        <MaturedView assetName={assetName} data={data} />
      </CardShell>
    );
  }

  return (
    <CardShell>
      <LiveView assetName={assetName} data={data} maturityDate={maturityDate} />
    </CardShell>
  );
}

function CardShell({ children }: { children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[1.65rem] bg-[#111317] p-6 shadow-[0_30px_84px_rgba(0,0,0,0.32)]">
      {children}
    </section>
  );
}

function MaturedView({ assetName, data }: { assetName: string; data: MarkToMarketResponse }) {
  const pnl = data.mtmPnl ?? 0;
  const positive = pnl >= 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-medium uppercase tracking-[0.24em] text-[#17c784]">Posición vencida</p>
          <h2 className="mt-2 text-[1.3rem] font-semibold text-white">{assetName}</h2>
        </div>
        <span className="rounded-full bg-[#0f2f24] px-3 py-1.5 text-[0.76rem] font-semibold text-[#20d48d]">
          Liquidada
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Invertido" value={formatCurrencyByCode(data.valorCompra, "MXN")} />
        <MetricCard label="Valor recibido" value={formatCurrencyByCode(data.valorAlVencimiento, "MXN")} />
        <MetricCard
          label="Ganancia final"
          value={`${positive ? "+" : "-"}${formatCurrencyByCode(Math.abs(pnl), "MXN")}`}
          tone={positive ? "positive" : "negative"}
        />
      </div>
    </div>
  );
}

function LiveView({
  assetName,
  data,
  maturityDate,
}: {
  assetName: string;
  data: MarkToMarketResponse;
  maturityDate?: string;
}) {
  if (data.valorHoy === null) {
    return (
      <div>
        <p className="text-[0.72rem] font-medium uppercase tracking-[0.24em] text-[#17c784]">Valor a Mercado</p>
        <h2 className="mt-2 text-[1.3rem] font-semibold text-white">{assetName}</h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <MetricCard label="Invertido" value={formatCurrencyByCode(data.valorCompra, "MXN")} />
          <MetricCard label="Al vencimiento" value={formatCurrencyByCode(data.valorAlVencimiento, "MXN")} />
        </div>

        <p className="mt-4 text-[0.78rem] text-[#7f8aa3]">
          Valuación a mercado no disponible temporalmente.
        </p>
      </div>
    );
  }

  const pnl = data.mtmPnl ?? 0;
  const pnlPct = data.mtmPnlPct ?? 0;
  const positive = pnl >= 0;
  const daysLabel = data.diasRestantes === 1 ? "Falta 1 día" : `Faltan ${data.diasRestantes} días`;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-medium uppercase tracking-[0.24em] text-[#17c784]">
            Valor a Mercado (hoy)
          </p>
          <h2 className="mt-2 text-[1.3rem] font-semibold text-white">{assetName}</h2>
        </div>
        <span
          aria-label="Valor a mercado = cuánto obtendrías si vendieras hoy, según la tasa actual de Banxico. Al vencimiento recibes el valor nominal."
          className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1b2130] text-[0.68rem] font-semibold text-[#8ea1bb]"
          role="img"
          title="Valor a mercado = cuánto obtendrías si vendieras hoy, según la tasa actual de Banxico. Al vencimiento recibes el valor nominal."
        >
          i
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <MetricCard label="Invertido" value={formatCurrencyByCode(data.valorCompra, "MXN")} />
        <MetricCard label="Valor hoy" value={formatCurrencyByCode(data.valorHoy, "MXN")} />
      </div>

      <div className="mt-4 rounded-[1.1rem] bg-[#0d0f13] p-4 shadow-[0_18px_36px_rgba(0,0,0,0.16)]">
        <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#71819b]">Si liquidas hoy</p>
        <p className={`mt-2 text-[1.08rem] font-semibold ${positive ? "text-[#17c784]" : "text-[#ff6b6b]"}`}>
          {positive ? "+" : "-"}
          {formatCurrencyByCode(Math.abs(pnl), "MXN")} ({positive ? "+" : ""}
          {pnlPct.toFixed(2)}%)
        </p>
      </div>

      <div className="mt-4 border-t border-[#1a1f29] pt-4">
        <MetricCard label="Al vencimiento" value={formatCurrencyByCode(data.valorAlVencimiento, "MXN")} />
        <p className="mt-3 text-[0.82rem] font-medium text-[#c7cedb]">
          {daysLabel}
          {maturityDate ? ` · vence ${formatMaturityDate(maturityDate)}` : ""}
        </p>
        {data.tasaCompra !== null || data.tasaHoy !== null ? (
          <p className="mt-1 text-[0.78rem] text-[#7f8aa3]">
            Tasa compra {formatRate(data.tasaCompra)} &middot; Tasa hoy {formatRate(data.tasaHoy)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive" ? "text-[#17c784]" : tone === "negative" ? "text-[#ff6b6b]" : "text-white";

  return (
    <div className="rounded-[1.1rem] bg-[#0d0f13] p-4 shadow-[0_18px_36px_rgba(0,0,0,0.16)]">
      <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#71819b]">{label}</p>
      <p className={`mt-3 text-[1.08rem] font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-32 rounded-full bg-[#1a1f29]" />
      <div className="mt-4 h-6 w-48 rounded-full bg-[#171c24]" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="h-20 rounded-[1.1rem] bg-[#0d0f13]" />
        <div className="h-20 rounded-[1.1rem] bg-[#0d0f13]" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div>
      <p className="text-[0.72rem] font-medium uppercase tracking-[0.24em] text-[#ff6b6b]">
        Valor a Mercado
      </p>
      <p className="mt-3 text-[0.84rem] leading-6 text-[#8a94a6]">{message}</p>
    </div>
  );
}

function formatRate(value: number | null) {
  return value === null ? "--" : `${value.toFixed(2)}%`;
}

function formatMaturityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}
