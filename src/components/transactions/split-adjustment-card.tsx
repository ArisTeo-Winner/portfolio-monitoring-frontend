"use client";

import { formatCurrencyByCode, type CurrencyCode } from "@/lib/utils/currency";
import { formatQuantity } from "@/lib/utils/format";
import type { SplitPreviewResponse } from "@/features/portfolio/types/split-preview.types";

// "2024-06-07" → "07/06/2024". Any other shape is returned untouched.
function formatExecutionDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return date;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

// "10-for-1, 07/06/2024" for a single split; "2 splits · factor acumulado ×N"
// when several stack. Used in both the detail badge and the modal notice.
function splitSummaryLabel(preview: SplitPreviewResponse): string {
  if (preview.splits.length === 1) {
    const split = preview.splits[0];
    return `${split.ratio}, ${formatExecutionDate(split.executionDate)}`;
  }
  if (preview.splits.length > 1) {
    return `${preview.splits.length} splits · factor ×${preview.factor}`;
  }
  return `factor ×${preview.factor}`;
}

function hasAdjustedAmounts(preview: SplitPreviewResponse): boolean {
  return (
    preview.splitDetected &&
    preview.original.quantity != null &&
    preview.original.pricePerUnit != null &&
    preview.adjusted.quantity != null &&
    preview.adjusted.pricePerUnit != null
  );
}

// A reverse split (factor < 1) shrinks the share count — "377 → 3.77" reads as
// "did I lose shares?" — so the price PER SHARE goes up and the reassurance that
// total value is unchanged is critical. FORWARD is the opposite (more shares,
// lower price). Derived from the factor so it holds even if splitType is null.
function priceMovesUp(preview: SplitPreviewResponse): boolean {
  return preview.factor < 1;
}

// The one line retail users must always see: the split changes how shares are
// counted, not what the position is worth.
const VALUE_UNCHANGED_COPY =
  "Tu inversión no cambió de valor — solo cambia cómo se cuentan los títulos.";

type Props = {
  preview: SplitPreviewResponse;
  /** Settlement currency for the displayed prices (USD/MXN). */
  currency: CurrencyCode;
};

/**
 * Detail-view "Ajuste por split" block (ADR-0011), rendered beneath the friction
 * breakdown. Shows the captured (raw) figures vs. the post-split equivalent so
 * the user understands why the dashboard shows different numbers than the ledger
 * row. Nothing here is persisted — it's a read-only overlay from split-preview.
 * The ledger row keeps showing the RAW capture, faithful to the broker receipt.
 */
export function SplitAdjustmentCard({ preview, currency }: Props) {
  if (!hasAdjustedAmounts(preview)) return null;
  const money = (value: number) => formatCurrencyByCode(value, currency);

  return (
    <section
      className="mt-5 overflow-hidden rounded-[1.1rem] bg-[#0d0f13] p-4 shadow-[0_18px_36px_rgba(0,0,0,0.16)]"
      data-testid="split-adjustment-card"
      aria-label="Ajuste por split"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#71819b]">
          Ajuste por split
        </p>
        <span
          className="inline-flex items-center rounded-full bg-[#15233a] px-2.5 py-1 text-[0.68rem] font-semibold text-[#5a8cff]"
          data-testid="split-ratio-badge"
        >
          {splitSummaryLabel(preview)}
        </span>
      </div>

      <dl className="mt-4 space-y-0">
        <EquivalenceRow
          label="Capturado (comprobante)"
          quantity={preview.original.quantity as number}
          price={money(preview.original.pricePerUnit as number)}
          testId="split-original"
        />
        <div className="my-2 border-t border-dashed border-[#1f2632]" />
        <EquivalenceRow
          label="Equivalente post-split"
          quantity={preview.adjusted.quantity as number}
          price={money(preview.adjusted.pricePerUnit as number)}
          emphasize
          testId="split-adjusted"
        />
      </dl>

      <p className="mt-3 text-[0.74rem] font-medium leading-5 text-[#8fe3b0]">{VALUE_UNCHANGED_COPY}</p>
      <p className="mt-1 text-[0.72rem] leading-5 text-[#6f7a8f]">
        Guardamos tu captura tal cual el comprobante; el portafolio muestra el equivalente post-split.
      </p>
    </section>
  );
}

function EquivalenceRow({
  label,
  quantity,
  price,
  emphasize = false,
  testId,
}: {
  label: string;
  quantity: number;
  price: string;
  emphasize?: boolean;
  testId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5" data-testid={testId}>
      <dt className="text-[0.82rem] text-[#7f8aa3]">{label}</dt>
      <dd
        className={
          emphasize
            ? "text-[0.95rem] font-semibold text-[#17c784]"
            : "text-[0.9rem] font-semibold text-[#b8c0ce]"
        }
      >
        {formatQuantity(quantity)} @ {price}
      </dd>
    </div>
  );
}

/**
 * Compact step-3 notice in the add-transaction modal. Informs the user a split
 * was detected and what the position will look like, WITHOUT changing the form:
 * the POST still sends the raw captured values. Renders nothing unless a split
 * was detected with amounts.
 */
export function SplitPreviewNotice({ preview, currency }: Props) {
  if (!hasAdjustedAmounts(preview)) return null;
  const money = (value: number) => formatCurrencyByCode(value, currency);
  const isReverse = preview.splitType === "REVERSE";
  const priceVerb = priceMovesUp(preview) ? "sube" : "baja";

  return (
    <div
      className={`rounded-[0.95rem] border px-3.5 py-2.5 ${
        isReverse ? "border-[#3a3360] bg-[#17132a]" : "border-[#2a3a5c] bg-[#111a2b]"
      }`}
      data-testid="split-preview-notice"
      data-split-type={preview.splitType ?? ""}
      role="status"
    >
      <p
        className={`flex items-center gap-1.5 text-[0.78rem] font-semibold ${
          isReverse ? "text-[#c4b5ff]" : "text-[#8fb4ff]"
        }`}
      >
        <ShieldCheck />
        Detectamos un split {splitSummaryLabel(preview)}
      </p>
      <p className="mt-1 text-[0.76rem] leading-5 text-[#aeb9cc]">
        Tus {formatQuantity(preview.original.quantity as number)} títulos se mostrarán como{" "}
        <span className="font-semibold text-white">{formatQuantity(preview.adjusted.quantity as number)}</span> y el
        precio por título {priceVerb} de {money(preview.original.pricePerUnit as number)} a{" "}
        <span className="font-semibold text-white">{money(preview.adjusted.pricePerUnit as number)}</span>.
      </p>
      <p className="mt-1.5 text-[0.74rem] font-medium leading-5 text-[#8fe3b0]">{VALUE_UNCHANGED_COPY}</p>
    </div>
  );
}

function ShieldCheck() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24">
      <path d="M12 3 5 5.5v5c0 4.2 2.9 7.6 7 8.5 4.1-.9 7-4.3 7-8.5v-5L12 3Z" fill="currentColor" opacity="0.2" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}
