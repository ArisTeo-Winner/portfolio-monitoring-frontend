"use client";

import { useMemo } from "react";
import { useReceivedDividends } from "@/features/portfolio/api/get-received-dividends";
import { summarizeReceivedByCurrency } from "@/features/portfolio/lib/received-dividends";
import { formatDividendDate } from "@/features/portfolio/lib/dividends-eligibility";
import type { ReceivedDividend } from "@/features/portfolio/types/received-dividend.types";
import { AssetAvatar } from "@/components/shared/AssetAvatar";

// ADR-0029 "Mis Dividendos" — the historical detail of dividends the user has
// RECEIVED, with their own gross/tax/net amounts. Complements the per-holding
// /growth summary (income, próximo pago). Self-hides on error (pre-ADR-0029
// backend) or when the user has received nothing yet.
export function MyDividendsTable() {
  const { data, isLoading, isError } = useReceivedDividends();

  const rows = useMemo(() => data ?? [], [data]);
  const totals = useMemo(() => summarizeReceivedByCurrency(rows), [rows]);

  if (isError) return null; // endpoint not available (e.g. backend predates ADR-0029)
  if (isLoading) {
    return (
      <p className="px-2 py-6 text-center text-[0.86rem] text-[#7f8aa3]">Cargando tus dividendos recibidos…</p>
    );
  }
  if (!rows.length) return null; // nothing received yet → keep the tab uncluttered

  return (
    <section data-testid="my-dividends" className="space-y-3">
      <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[0.72rem] font-medium uppercase tracking-[0.1em] text-[#71819b]">Mis dividendos recibidos</p>
          <p className="mt-1 text-[0.8rem] text-[#7f8aa3]">Lo que realmente cobraste — bruto, retención y neto.</p>
        </div>
        {totals.length ? (
          <div className="flex flex-wrap gap-2">
            {totals.map((t) => (
              <span
                key={t.currency}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#1b2028] bg-[#0f1217] px-3 py-1 text-[0.76rem] text-[#9daccc]"
              >
                <b className="font-semibold tabular-nums text-white">{money(t.net)}</b> {t.currency}
                <span className="text-[0.64rem] text-[#5f6d82]">neto</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-[1rem] border border-[#1b2028]">
        <table className="w-full min-w-[760px] border-collapse text-[0.84rem]">
          <thead>
            <tr className="border-b border-[#1b2028] text-[0.66rem] uppercase tracking-[0.08em] text-[#5f6d82]">
              <th className="px-4 py-3 text-left font-semibold">Activo</th>
              <th className="px-4 py-3 text-left font-semibold">Pagado</th>
              <th className="px-4 py-3 text-left font-semibold">Ex-fecha</th>
              <th className="px-4 py-3 text-right font-semibold">Acciones</th>
              <th className="px-4 py-3 text-right font-semibold">Div/acción</th>
              <th className="px-4 py-3 text-right font-semibold">Bruto</th>
              <th className="px-4 py-3 text-right font-semibold">Retención</th>
              <th className="px-4 py-3 text-right font-semibold">Neto</th>
              <th className="px-4 py-3 text-right font-semibold">Tipo</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r, index) => (
              <tr
                key={`${r.symbol}-${r.paymentDate}-${index}`}
                className="border-b border-[#14181f] last:border-none hover:bg-[#13161b]"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <AssetAvatar assetType="STOCK" dark symbol={r.symbol} logoUrl={r.logoUrl} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{r.assetName ?? r.symbol}</p>
                      <p className="text-[0.7rem] text-[#5f6d82]">{r.symbol}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-left text-white">{formatPaymentDate(r.paymentDate)}</td>
                <td className="px-4 py-3 text-left text-[#9daccc]">{formatDividendDate(r.exDate) ?? "—"}</td>
                <td className="px-4 py-3 text-right text-white">{r.shares != null ? trimNumber(r.shares) : em()}</td>
                <td className="px-4 py-3 text-right text-[#9daccc]">
                  {r.amountPerShare != null ? `${money(r.amountPerShare)} ${r.currency}` : em()}
                </td>
                <td className="px-4 py-3 text-right text-white">{money(r.grossAmount)} {r.currency}</td>
                <td className="px-4 py-3 text-right text-[#9daccc]">
                  {r.taxWithheld > 0 ? `-${money(r.taxWithheld)} ${r.currency}` : em()}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-[#1fd38b]">{money(r.netAmount)} {r.currency}</td>
                <td className="px-4 py-3 text-right">
                  <TypeBadge type={r.type} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-3 text-[0.72rem] text-[#5f6d82]">
          Solo dividendos ya cobrados (fecha de pago ≤ hoy). Cada fila en su propia moneda; los montos no se suman entre
          monedas. El neto ya incluye la retención.
        </p>
      </div>
    </section>
  );
}

function TypeBadge({ type }: { type: ReceivedDividend["type"] }) {
  const isCash = type === "CASH";
  return (
    <span
      className={`inline-flex w-max items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-medium ${
        isCash ? "border-[#1d3a2b] bg-[#0e1a14] text-[#1fd38b]" : "border-[#23324a] bg-[#0e1420] text-[#6ea8ff]"
      }`}
    >
      {isCash ? "Efectivo" : "Acciones"}
    </span>
  );
}

function em() {
  return <span className="text-[#5f6d82]">—</span>;
}

function money(value: number): string {
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function trimNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

// The payment date is a calendar date the backend encodes as an instant (often
// ET midnight = 04:00Z). Converting that instant to the viewer's zone can shift
// it a day, so take the ISO's date component and format it as a plain local date
// (no timezone math) — the user always sees the date the backend meant.
function formatPaymentDate(iso: string): string {
  return formatDividendDate(iso.split("T")[0]) ?? iso;
}
