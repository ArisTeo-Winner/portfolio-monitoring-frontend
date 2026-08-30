import type { ImportJob } from "@/features/import/types/import.types";
import type { TransactionResponse } from "@/features/transactions/types/transaction.types";
import { channelOfJob } from "@/features/import/lib/import-channel";

// The backend gives us no importJobId on a transaction, so a job's rows are
// attributed heuristically: they carry the channel's broker + currency and were
// created inside the job's processing window. A small buffer absorbs clock skew
// between the job timestamps and the row's createdAt.
const WINDOW_BUFFER_MS = 5_000;

function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/**
 * Selects the transactions a completed import job most likely created.
 *
 * Match = same broker (case-insensitive) AND same currency AND createdAt within
 * [job.createdAt − buffer, job.completedAt + buffer]. When completedAt is
 * missing the window stays open to `now`. Newest first.
 *
 * This is a best-effort attribution, not an exact join: a manual transaction on
 * the same broker/currency created during the exact processing window would
 * also match. That is acceptable for an immediately-after-import review.
 */
export function selectImportedTransactions(
  transactions: TransactionResponse[],
  job: ImportJob,
  now: number = Date.now(),
): TransactionResponse[] {
  const channel = channelOfJob(job);
  if (!channel) return [];

  const lower = (parseTime(job.createdAt) ?? 0) - WINDOW_BUFFER_MS;
  const upper = (parseTime(job.completedAt) ?? now) + WINDOW_BUFFER_MS;
  const broker = channel.broker.toLowerCase();

  return transactions
    .filter((tx) => {
      if ((tx.broker ?? "").toLowerCase() !== broker) return false;
      if ((tx.currency ?? "").toUpperCase() !== channel.currency) return false;
      const created = parseTime(tx.createdAt);
      return created !== null && created >= lower && created <= upper;
    })
    .sort((a, b) => (parseTime(b.createdAt) ?? 0) - (parseTime(a.createdAt) ?? 0));
}
