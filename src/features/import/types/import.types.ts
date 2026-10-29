// Contract for the GBM broker-import feature (finalized backend, springdoc).
//
// Upload is asynchronous: POST .../broker/gbm/import returns 202 with one job
// per uploaded PDF. Each job is then polled until it reaches a terminal state
// (COMPLETED or DEAD_LETTER). Amounts inside COMPLETED results are integer
// counts, not money, so there is no decimal-precision concern here.

export type ImportJobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "DEAD_LETTER";

/** Present only when status === "COMPLETED". */
export type ImportJobResult = {
  fileName: string;
  accepted: number;
  duplicate: number;
  skipped: number;
  rejected: number;
  messages: string[];
};

export type ImportJob = {
  jobId: string;
  fileName: string;
  jobType: string | null;
  status: ImportJobStatus;
  result: ImportJobResult | null;
  errorMessage: string | null;
  attemptCount: number;
  createdAt: string;
  completedAt: string | null;
};

export const TERMINAL_STATUSES: ReadonlySet<ImportJobStatus> = new Set<ImportJobStatus>([
  "COMPLETED",
  "DEAD_LETTER",
]);

export function isTerminal(job: Pick<ImportJob, "status">): boolean {
  return TERMINAL_STATUSES.has(job.status);
}
