"use client";

import { useCallback, useState } from "react";
import { getUserTransactions } from "@/features/transactions/api/get-transactions";
import { deleteTransaction } from "@/features/transactions/api/create-transaction";
import type { TransactionResponse } from "@/features/transactions/types/transaction.types";
import type { ImportJob } from "@/features/import/types/import.types";
import { selectImportedTransactions } from "@/features/import/lib/select-imported-transactions";
import { ApiError, getProblemMessage } from "@/lib/api/problem-details";

function messageFromError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.problem?.detail?.trim() || getProblemMessage(error);
  return error instanceof Error ? error.message : fallback;
}

type Options = {
  /** Called after a successful delete so the caller can refresh portfolio state. */
  onChanged?: () => void;
};

/**
 * Loads the transactions attributed to one completed import job and lets the
 * user delete the ones that were parsed wrong. Deletion is permanent (there is
 * no server-side undo), so the UI confirms before calling remove().
 */
export function useImportReview(job: ImportJob, { onChanged }: Options = {}) {
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const all = await getUserTransactions();
      setTransactions(selectImportedTransactions(all, job));
      setLoaded(true);
    } catch (error) {
      setLoadError(messageFromError(error, "No se pudieron cargar las transacciones importadas."));
    } finally {
      setLoading(false);
    }
  }, [job]);

  const remove = useCallback(
    async (transactionId: string) => {
      setDeletingId(transactionId);
      setDeleteError(null);
      try {
        await deleteTransaction(transactionId);
        setTransactions((prev) => prev.filter((tx) => tx.transactionId !== transactionId));
        onChanged?.();
      } catch (error) {
        setDeleteError(messageFromError(error, "No se pudo eliminar la transacción."));
      } finally {
        setDeletingId(null);
      }
    },
    [onChanged],
  );

  return { transactions, loading, loaded, loadError, deletingId, deleteError, load, remove };
}
