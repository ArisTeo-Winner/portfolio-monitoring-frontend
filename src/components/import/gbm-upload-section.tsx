"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ProblemAlert } from "@/components/ui/problem-alert";
import { ImportJobCard } from "@/components/import/import-job-card";
import { useGbmImport } from "@/features/import/hooks/use-gbm-import";

type Props = {
  /** Called once per job that completes with at least one accepted transaction. */
  onImported?: () => void;
};

export function GbmUploadSection({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { jobs, uploading, uploadError, retryErrors, loadingRecent, stalled, upload, retry, refresh, loadRecent } =
    useGbmImport();

  // Load the recent-uploads history once on mount.
  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  // Fire onImported exactly once per newly-completed job that imported rows.
  const notifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!onImported) return;
    for (const job of jobs) {
      if (job.status === "COMPLETED" && (job.result?.accepted ?? 0) > 0 && !notifiedRef.current.has(job.jobId)) {
        notifiedRef.current.add(job.jobId);
        onImported();
      }
    }
  }, [jobs, onImported]);

  function handleFilesChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void upload(files);
  }

  return (
    <div className="space-y-4" data-testid="gbm-upload-section">
      <div>
        <Button
          data-testid="gbm-import-trigger"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          type="button"
          variant="secondary"
        >
          {uploading ? "Subiendo…" : "Seleccionar comprobantes (.pdf)"}
        </Button>
        <p className="mt-1 text-xs text-neutral-500">
          Detectamos el broker automáticamente. Puedes subir uno o varios PDF a la vez.
        </p>
        <input
          accept=".pdf,application/pdf"
          className="hidden"
          data-testid="gbm-import-input"
          multiple
          onChange={handleFilesChosen}
          ref={inputRef}
          type="file"
        />
      </div>

      {uploadError ? <ProblemAlert message={uploadError} /> : null}

      {stalled ? (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300"
          data-testid="import-poll-stalled"
        >
          <span>La verificación está tardando más de lo normal.</span>
          <Button data-testid="import-refresh" onClick={refresh} type="button" variant="outline">
            Actualizar estado
          </Button>
        </div>
      ) : null}

      {jobs.length > 0 ? (
        <div className="space-y-3" data-testid="import-jobs-list">
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">Cargas recientes</h4>
          {jobs.map((job) => (
            <ImportJobCard job={job} key={job.jobId} onRetry={retry} retryError={retryErrors[job.jobId]} />
          ))}
        </div>
      ) : loadingRecent ? (
        <p className="text-sm text-neutral-500" data-testid="import-jobs-loading">
          Cargando historial…
        </p>
      ) : (
        <p className="text-sm text-neutral-500" data-testid="import-jobs-empty">
          Aún no has subido comprobantes.
        </p>
      )}
    </div>
  );
}
