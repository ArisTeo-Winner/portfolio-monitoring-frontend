"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProblemAlert } from "@/components/ui/problem-alert";
import { useImportReview } from "@/features/import/hooks/use-import-review";
import { channelOfJob } from "@/features/import/lib/import-channel";
import type { ImportJob } from "@/features/import/types/import.types";
import type { TransactionResponse } from "@/features/transactions/types/transaction.types";
import { formatCurrencyByCode, type CurrencyCode } from "@/lib/utils/currency";
import { formatQuantity } from "@/lib/utils/format";

type Props = {
  job: ImportJob;
  /** Fired after a delete so the parent can refresh portfolio/history caches. */
  onChanged?: () => void;
};

function sideLabel(type: string): { label: string; className: string } {
  const t = type.toUpperCase();
  if (t.includes("BUY") || t.includes("COMPRA")) return { label: "Compra", className: "text-[#20d48d]" };
  if (t.includes("SELL") || t.includes("VENTA")) return { label: "Venta", className: "text-[#ff8088]" };
  return { label: type, className: "text-[#8a94a6]" };
}

function shortDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(t);
}

export function ImportReviewPanel({ job, onChanged }: Props) {
  const channel = channelOfJob(job);
  const currency = (channel?.currency ?? "USD") as CurrencyCode;
  const { transactions, loading, loaded, loadError, deletingId, deleteError, load, remove } = useImportReview(job, {
    onChanged,
  });

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mt-2.5 border-t border-[#161b24] pt-2.5" data-testid="import-review-panel">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h5 className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-neutral-500">
          Revisar importadas
        </h5>
        {loaded && transactions.length > 0 ? (
          <span className="text-[0.68rem] text-neutral-500" data-testid="import-review-count">
            {transactions.length} en esta carga
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="text-xs text-[#8a94a6]" data-testid="import-review-loading">
          Cargando transacciones…
        </p>
      ) : loadError ? (
        <ProblemAlert
          className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400"
          message={loadError}
        />
      ) : transactions.length === 0 ? (
        <p className="text-xs text-[#8a94a6]" data-testid="import-review-empty">
          No encontramos transacciones para revisar de esta carga.
        </p>
      ) : (
        <>
          <ul className="space-y-1.5" data-testid="import-review-list">
            {transactions.map((tx) => (
              <ReviewRow
                key={tx.transactionId}
                tx={tx}
                currency={currency}
                deleting={deletingId === tx.transactionId}
                onDelete={() => remove(tx.transactionId)}
              />
            ))}
          </ul>
          {deleteError ? (
            <p className="mt-2 text-xs text-[#ff9ea3]" data-testid="import-review-delete-error" role="alert">
              {deleteError}
            </p>
          ) : null}
          <p className="mt-2 text-[0.68rem] leading-4 text-neutral-500">
            Eliminar una transacción es permanente y actualiza tu portafolio.
          </p>
        </>
      )}
    </div>
  );
}

function ReviewRow({
  tx,
  currency,
  deleting,
  onDelete,
}: {
  tx: TransactionResponse;
  currency: CurrencyCode;
  deleting: boolean;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const side = sideLabel(tx.transactionType);

  return (
    <li
      className="flex items-center justify-between gap-3 rounded-lg border border-[#161b24] bg-[#0b0d10] px-3 py-2"
      data-testid="import-review-row"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#e6eaf1]">
          <span className="truncate" title={tx.assetSymbol}>
            {tx.assetSymbol}
          </span>
          <span className={`shrink-0 text-[0.68rem] font-semibold uppercase tracking-wide ${side.className}`}>
            {side.label}
          </span>
        </p>
        <p
          className="mt-0.5 truncate text-[0.7rem] text-[#71819b]"
          title={`${formatQuantity(tx.quantity)} × ${formatCurrencyByCode(tx.pricePerUnit, currency)} · ${shortDate(tx.transactionDate)}`}
        >
          {formatQuantity(tx.quantity)} × {formatCurrencyByCode(tx.pricePerUnit, currency)} · {shortDate(tx.transactionDate)}
        </p>
      </div>

      {/* Confirm state hides the total to free horizontal room on narrow (375px) screens. */}
      {confirming ? (
        <span className="flex shrink-0 items-center gap-1.5" data-testid="import-review-confirm">
          <Button
            className="h-9 px-2.5 py-1 text-xs"
            data-testid="import-review-confirm-yes"
            disabled={deleting}
            onClick={onDelete}
            type="button"
            variant="danger"
          >
            {deleting ? "Eliminando…" : "Eliminar"}
          </Button>
          <Button
            className="h-9 px-2.5 py-1 text-xs"
            disabled={deleting}
            onClick={() => setConfirming(false)}
            type="button"
            variant="outline"
          >
            Cancelar
          </Button>
        </span>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-[#e6eaf1]">
            {formatCurrencyByCode(tx.totalValue, currency)}
          </span>
          <button
            aria-label={`Eliminar ${tx.assetSymbol}`}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#1c222d] text-[#8a94a6] transition-colors hover:border-red-500/40 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
            data-testid="import-review-delete"
            onClick={() => setConfirming(true)}
            type="button"
          >
            <TrashIcon />
          </button>
        </div>
      )}
    </li>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden fill="none" height="15" viewBox="0 0 24 24" width="15">
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
