"use client";

import { formatCurrencyByCode, type CurrencyCode } from "@/lib/utils/currency";
import type { FrictionBreakdown } from "@/features/transactions/types/transaction.types";

type Props = {
  breakdown: FrictionBreakdown;
  /** Raw backend transactionType (e.g. "BUY", "SELL"). Drives the +/- sign. */
  transactionType: string;
  /** Settlement currency for every amount in the breakdown (e.g. "USD", "MXN"). */
  feeCurrency: string;
};

function toCurrencyCode(feeCurrency: string): CurrencyCode {
  return feeCurrency?.toUpperCase() === "MXN" ? "MXN" : "USD";
}

/**
 * Brokerage friction audit card.
 *
 * Renders the server-computed cost ledger of a transaction:
 *   Monto bruto → (+/−) Comisión → (+/−) IVA → (+/−) Otros cargos →
 *   Costo neto real → Precio efectivo/u
 *
 * The four fine-grained fields are null on manual entries; per the contract we
 * show them ONLY when brokerCommission != null. The derived fields (gross,
 * total, net, adjusted) are always shown. Nothing is recomputed client-side —
 * every figure comes straight from `breakdown`.
 */
export function FrictionBreakdownCard({ breakdown, transactionType, feeCurrency }: Props) {
  const currency = toCurrencyCode(feeCurrency);
  const money = (value: number) => formatCurrencyByCode(value, currency);

  const isSell = transactionType?.toUpperCase() === "SELL";
  // BUY: friction is added on top of the gross cost. SELL: friction is
  // deducted from the gross proceeds. The sign is purely presentational — the
  // backend already applied the direction to totalFrictionCost / finalNetCost.
  const sign = isSell ? "−" : "+";

  const showFine = breakdown.brokerCommission != null;
  const needsReview = breakdown.reviewStatus === "REQUIERE_REVISION";

  const netLabel = isSell ? "Neto recibido real" : "Costo neto real";

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
        <div
          className="mt-3 flex items-center justify-between gap-3 rounded-[0.85rem] bg-[#111621] px-3 py-2.5"
          data-testid="friction-adjusted-unit-price"
        >
          <span className="text-[0.72rem] font-medium uppercase tracking-[0.14em] text-[#71819b]">
            Precio efectivo/u
          </span>
          <span className="text-[0.95rem] font-semibold text-[#17c784]">
            {money(breakdown.adjustedUnitPrice)}
          </span>
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
