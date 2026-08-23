"use client";

import { Button } from "@/components/ui/button";
import type { ImportJob, ImportJobResult } from "@/features/import/types/import.types";

type Props = {
  job: ImportJob;
  retryError?: string;
  onRetry: (jobId: string) => void;
};

function plural(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

function secondaryCounts(result: ImportJobResult): string {
  const parts: string[] = [];
  if (result.duplicate > 0) parts.push(plural(result.duplicate, "duplicada", "duplicadas"));
  if (result.skipped > 0) parts.push(plural(result.skipped, "omitida", "omitidas"));
  if (result.rejected > 0) parts.push(plural(result.rejected, "rechazada", "rechazadas"));
  return parts.join(" · ");
}

export function ImportJobCard({ job, retryError, onRetry }: Props) {
  const isBusy = job.status === "QUEUED" || job.status === "PROCESSING";
  const isDone = job.status === "COMPLETED";
  const isFailed = job.status === "DEAD_LETTER";

  return (
    <div
      className="rounded-[1rem] border border-[#1c222d] bg-[#0d0f13] px-4 py-3"
      data-testid="import-job-card"
      data-status={job.status}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#e6eaf1]" title={job.fileName}>
            {job.fileName}
          </p>

          {isBusy ? (
            <p className="mt-1 flex items-center gap-2 text-xs text-[#8a94a6]" data-testid="import-job-status">
              <Spinner />
              {job.status === "QUEUED" ? "En cola…" : "Procesando…"}
            </p>
          ) : null}

          {isDone && job.result ? (
            <p className="mt-1 text-xs text-[#8a94a6]" data-testid="import-job-status">
              <span className="font-semibold text-[#17c784]" data-testid="import-job-accepted">
                {plural(job.result.accepted, "transacción importada", "transacciones importadas")}
              </span>
              {secondaryCounts(job.result) ? (
                <span className="text-[#71819b]"> · {secondaryCounts(job.result)}</span>
              ) : null}
            </p>
          ) : null}

          {isFailed ? (
            <p className="mt-1 text-xs text-[#ff9ea3]" data-testid="import-job-error">
              {job.errorMessage?.trim() || "No se pudo procesar el archivo."}
            </p>
          ) : null}
        </div>

        <StatusPill status={job.status} />
      </div>

      {isDone && job.result?.messages?.length ? (
        <ul className="mt-2 space-y-0.5 border-t border-[#161b24] pt-2">
          {job.result.messages.map((message, index) => (
            <li className="text-[0.72rem] leading-4 text-[#71819b]" key={index}>
              {message}
            </li>
          ))}
        </ul>
      ) : null}

      {isFailed ? (
        <div className="mt-2.5 flex items-center gap-3">
          <Button
            data-testid="import-job-retry"
            onClick={() => onRetry(job.jobId)}
            type="button"
            variant="outline"
          >
            Reintentar
          </Button>
          {retryError ? (
            <span className="text-xs text-[#ff9ea3]" data-testid="import-job-retry-error">
              {retryError}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: ImportJob["status"] }) {
  const map: Record<ImportJob["status"], { label: string; className: string }> = {
    QUEUED: { label: "En cola", className: "bg-[#1b2130] text-[#8ea1bb]" },
    PROCESSING: { label: "Procesando", className: "bg-[#132433] text-[#5aa9e6]" },
    COMPLETED: { label: "Completado", className: "bg-[#0f2f24] text-[#20d48d]" },
    DEAD_LETTER: { label: "Error", className: "bg-[#31161a] text-[#ff8088]" },
  };
  const { label, className } = map[status];
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${className}`}>
      {label}
    </span>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[#3861fb] border-t-transparent"
    />
  );
}
