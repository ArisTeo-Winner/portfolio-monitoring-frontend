"use client";

import { formatCurrencyByCode, type CurrencyCode } from "@/lib/utils/currency";
import type { FrictionBreakdown } from "@/features/transactions/types/transaction.types";

type Props = {
  breakdown: FrictionBreakdown;
  /** Raw backend transactionType (e.g. "BUY", "SELL"). Drives the +/- sign. */
  transactionType: string;
  /** Settlement currency for every amount in the breakdown (e.g. "USD", "MXN"). */
  feeCurrency: string;
  /**
   * Executed price per unit at the broker (backend `pricePerUnit`), shown next
   * to the friction-adjusted price so the user can compare the raw fill against
   * the all-in break-even. Null/undefined → the execution row is hidden.
   */
  executionUnitPrice?: number | null;
};

function toCurrencyCode(feeCurrency: string): CurrencyCode {
  return feeCurrency?.toUpperCase() === "MXN" ? "MXN" : "USD";
}

/**
 * Brokerage friction audit card.
 *
 * Renders the server-computed cost ledger of a transaction:
 *   Monto bruto → (+/−) Comisión → (+/−) IVA → (+/−) Otros cargos →
 *   Costo neto real → [Precio de ejecución/u] + Precio de equilibrio/u (BUY) /
 *   Precio neto/u (SELL)
 *
 * The four fine-grained fields are null on manual entries; per the contract we
 * show them ONLY when brokerCommission != null. The derived fields (gross,
 * total, net, adjusted) are always shown. Nothing is recomputed client-side —
 * every figure comes straight from `breakdown`.
 */
export function FrictionBreakdownCard({
  breakdown,
  transactionType,
  feeCurrency,
  executionUnitPrice,
}: Props) {
  const currency = toCurrencyCode(feeCurrency);
  const money = (value: number) => formatCurrencyByCode(value, currency);

  const isSell = transactionType?.toUpperCase() === "SELL";
  // BUY: friction is added on top of the gross cost. SELL: friction is
  // deducted from the gross proceeds. The sign is purely presentational — the
  // backend already applied the direction to totalFrictionCost / finalNetCost.
  const sign = isSell ? "−" : "+";

  const showFine = breakdown.brokerCommission != null;
  const needsReview = breakdown.reviewStatus === "REQUIERE_REVISION";

  // On a BUY this net line IS the true cost basis (principal + friction), so we
  // name it accordingly — the standard definition includes fees. On a SELL it is
  // the net proceeds actually received.
  const netLabel = isSell ? "Neto recibido real" : "Costo base (neto real)";
  // Direction-aware label for the friction-adjusted unit price. On a BUY this is
  // the all-in break-even (what each unit must reach to recover cost + friction);
  // on a SELL it is the net price actually received per unit. Keep the "/u"
  // suffix — this card renders for stocks, ETFs and crypto alike, so "por acción"
  // would be wrong for crypto units.
  const adjustedLabel = isSell ? "Precio neto/u" : "Precio de equilibrio/u";
  const showExecution = executionUnitPrice != null;
  // Backend-provided friction per unit (totalFrictionCost / quantity). Renders
  // the "+ fricción/u" bridge between execution and adjusted price. Guarded so
  // it stays hidden until the backend ships the field. No client-side math.
  const showBridge = showExecution && breakdown.perUnitFriction != null;

  return (
    <section
      className="mt-5 overflow-hidden rounded-[1.1rem] bg-[#0d0f13] p-4 shadow-[0_18px_36px_rgba(0,0,0,0.16)]"
      data-testid="friction-breakdown-card"
      aria-label="Desglose de fricción de corretaje"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[#71819b]">
          Desglose de fricción
        </p>
        {needsReview ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-[#3a2a0f] px-2.5 py-1 text-[0.68rem] font-semibold text-[#f5b544]"
            data-testid="friction-review-badge"
          >
            <WarningDot />
            Requiere revisión
          </span>
        ) : null}
      </div>

      <dl className="mt-4 space-y-0">
        <LedgerRow label="Monto bruto" value={money(breakdown.grossAmount)} />

        {showFine ? (
          <>
            <LedgerRow
              label="Comisión del broker"
              sign={sign}
              value={money(breakdown.brokerCommission ?? 0)}
              muted
              testId="friction-commission"
            />
            <LedgerRow
              label="IVA"
              sign={sign}
              value={money(breakdown.brokerIva ?? 0)}
              muted
              testId="friction-iva"
            />
            <LedgerRow
              label="Otros cargos"
              sign={sign}
              value={money(breakdown.otherFees ?? 0)}
              muted
              testId="friction-other-fees"
            />
          </>
        ) : null}

        <LedgerRow
          label="Costo de fricción total"
          sign={sign}
          value={money(breakdown.totalFrictionCost)}
          testId="friction-total"
        />

        <div className="my-2 border-t border-dashed border-[#1f2632]" />

        <LedgerRow label={netLabel} value={money(breakdown.finalNetCost)} emphasize testId="friction-net" />
      </dl>

      {breakdown.adjustedUnitPrice != null ? (
        <div className="mt-3 rounded-[0.85rem] bg-[#111621] px-3 py-2.5">
          {showExecution ? (
            <div
              className={`flex items-center justify-between gap-3 ${showBridge ? "pb-1" : "pb-2"}`}
              data-testid="friction-execution-unit-price"
            >
              <span className="text-[0.72rem] font-medium uppercase tracking-[0.14em] text-[#71819b]">
                Precio de ejecución/u
              </span>
              <span className="text-[0.85rem] font-semibold text-[#9aa5b8]">
                {money(executionUnitPrice as number)}
              </span>
            </div>
          ) : null}
          {showBridge ? (
            <div
              className="flex items-center justify-between gap-3 pb-2 pl-3"
              data-testid="friction-per-unit"
            >
              <span className="text-[0.72rem] font-medium text-[#7f8aa3]">
                <span className="mr-1 text-[#71819b]">{sign}</span>
                fricción/u
              </span>
              <span className="text-[0.82rem] font-semibold text-[#9aa5b8]">
                {money(breakdown.perUnitFriction as number)}
              </span>
            </div>
          ) : null}
          <div
            className={`flex items-center justify-between gap-3 ${
              showExecution ? "border-t border-dashed border-[#1f2632] pt-2" : ""
            }`}
            data-testid="friction-adjusted-unit-price"
          >
            <span className="text-[0.72rem] font-medium uppercase tracking-[0.14em] text-[#71819b]">
              {adjustedLabel}
            </span>
            <span className="text-[0.95rem] font-semibold text-[#17c784]">
              {money(breakdown.adjustedUnitPrice)}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function LedgerRow({
  label,
  value,
  sign,
  muted = false,
  emphasize = false,
  testId,
}: {
  label: string;
  value: string;
  sign?: string;
  muted?: boolean;
  emphasize?: boolean;
  testId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5" data-testid={testId}>
      <dt className={`text-[0.82rem] ${muted ? "text-[#7f8aa3]" : "font-semibold text-[#b8c0ce]"}`}>
        {sign ? <span className="mr-1 text-[#71819b]">{sign}</span> : null}
        {label}
      </dt>
      <dd
        className={
          emphasize
            ? "text-[1.02rem] font-semibold text-white"
            : `text-[0.9rem] font-semibold ${muted ? "text-[#9aa5b8]" : "text-[#b8c0ce]"}`
        }
      >
        {value}
      </dd>
    </div>
  );
}

function WarningDot() {
  return (
    <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24">
      <path d="M12 3.75 21 19.5a1.2 1.2 0 0 1-1.05 1.8H4.05A1.2 1.2 0 0 1 3 19.5L12 3.75Z" fill="currentColor" opacity="0.22" />
      <path d="M12 8.75v5.25M12 17.5h.008" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}
