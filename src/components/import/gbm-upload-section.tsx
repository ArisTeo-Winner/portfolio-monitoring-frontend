"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { GbmChannelCard } from "@/components/import/gbm-channel-card";
import { ImportJobCard } from "@/components/import/import-job-card";
import { useGbmImport } from "@/features/import/hooks/use-gbm-import";

type Props = {
  /** Called once per job that completes with at least one accepted transaction. */
  onImported?: () => void;
};

export function GbmUploadSection({ onImported }: Props) {
  const {
    jobs,
    uploading,
    uploadError,
    retryErrors,
    loadingRecent,
    stalled,
    uploadStatement,
    uploadConfirmations,
    retry,
    refresh,
    loadRecent,
  } = useGbmImport();

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

  return (
    <div className="space-y-5" data-testid="gbm-upload-section">
      <div className="grid gap-3 md:grid-cols-2">
        <GbmChannelCard
          accent="mxn"
          currency="MXN"
          custodian="GBM · Mercado nacional"
          title="Estado de cuenta mensual"
          description="Saldos y operaciones en pesos: Smart Cash (renta fija y efectivo) y Trading México en BMV y SIC."
          useCases={["Smart Cash", "Trading México", "BMV", "SIC"]}
          loadRule="Un archivo por mes de consulta"
          multiple={false}
          dropHint="Cargar estado de cuenta (.pdf)"
          uploading={uploading.statement}
          error={uploadError.statement}
          onFiles={(files) => void uploadStatement(files[0])}
          testid="gbm-channel-statement"
        />

        <GbmChannelCard
          accent="usd"
          currency="USD"
          custodian="Custodio DriveWealth LLC"
          title="Confirmaciones DriveWealth"
          description="Transacciones en dólares con soporte de fracciones para la estrategia de Trading Global / Trading USA."
          useCases={["Trading Global", "Trading USA", "Fracciones"]}
          loadRule="Carga múltiple: un PDF por día de operación"
          multiple
          dropHint="Cargar confirmaciones (.pdf)"
          uploading={uploading.confirmations}
          error={uploadError.confirmations}
          onFiles={(files) => void uploadConfirmations(files)}
          testid="gbm-channel-drivewealth"
        />
      </div>

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
            <ImportJobCard
              job={job}
              key={job.jobId}
              onRetry={retry}
              onReviewChanged={onImported}
              retryError={retryErrors[job.jobId]}
            />
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
