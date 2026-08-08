"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ProblemAlert } from "@/components/ui/problem-alert";
import { ComingSoonPanel } from "@/components/import/coming-soon-panel";
import { ImportSummary } from "@/components/import/import-summary";
import { PreviewTable } from "@/components/import/preview-table";
import { useGbmImport } from "@/features/import/hooks/use-gbm-import";
import type { GbmDocType } from "@/features/import/types/import.types";

type Props = {
  docType: GbmDocType;
  title: string;
  subtitle: string;
  multiple: boolean;
  testId: string;
  onImported?: () => void;
};

export function GbmUploadSection({ docType, title, subtitle, multiple, testId, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { state, summary, selectFiles, toggleRow, confirmSelected, reset } = useGbmImport(docType);

  function handleFilesChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void selectFiles(files);
  }

  return (
    <div className="space-y-3" data-testid={testId}>
      <div>
        <Button
          data-testid={`${testId}-trigger`}
          disabled={state.status === "loading" || state.status === "confirming"}
          onClick={() => inputRef.current?.click()}
          type="button"
          variant="secondary"
        >
          {title}
        </Button>
        <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>
        <input
          accept=".pdf"
          className="hidden"
          data-testid={`${testId}-input`}
          multiple={multiple}
          onChange={handleFilesChosen}
          ref={inputRef}
          type="file"
        />
      </div>

      {state.notImplemented ? <ComingSoonPanel /> : null}

      {state.scannedPdfWarning ? (
        <div
          className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400"
          data-testid={`${testId}-scanned-pdf-warning`}
        >
          PDF escaneado, súbelo en texto o regístralo manual.
        </div>
      ) : null}

      {state.error ? <ProblemAlert message={state.error} /> : null}

      {state.status === "loading" ? (
        <p className="text-sm text-neutral-400" data-testid={`${testId}-loading`}>
          Procesando PDF…
        </p>
      ) : null}

      {state.status === "previewed" || state.status === "confirming" ? (
        <div className="space-y-3">
          <PreviewTable onToggle={toggleRow} rows={state.rows} selectedRowIds={state.selectedRowIds} />
          <ImportSummary
            duplicateCount={summary.duplicateCount}
            errorCount={summary.errorCount}
            newCount={summary.newCount}
          />
          <Button
            data-testid={`${testId}-confirm`}
            disabled={state.selectedRowIds.size === 0 || state.status === "confirming"}
            onClick={() => void confirmSelected(onImported)}
            type="button"
          >
            {state.status === "confirming" ? "Importando…" : "Importar seleccionadas"}
          </Button>
        </div>
      ) : null}

      {state.status === "confirmed" ? (
        <div className="space-y-3">
          <p
            className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400"
            data-testid={`${testId}-success`}
          >
            {state.importedCount} transacciones importadas correctamente.
          </p>
          <Button onClick={reset} type="button" variant="outline">
            Cargar otro archivo
          </Button>
        </div>
      ) : null}
    </div>
  );
}
