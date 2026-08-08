"use client";

import { useCallback, useMemo, useState } from "react";
import { ApiError, getProblemMessage } from "@/lib/api/problem-details";
import { confirmImport, previewImport } from "@/features/import/api/import-broker-documents";
import { SCANNED_PDF_ERROR_CODE } from "@/features/import/types/import.types";
import type { GbmDocType, ImportPreviewRow } from "@/features/import/types/import.types";

type ImportStatus = "idle" | "loading" | "previewed" | "confirming" | "confirmed";

type GbmImportState = {
  status: ImportStatus;
  rows: ImportPreviewRow[];
  previewId: string | null;
  selectedRowIds: Set<string>;
  error: string | null;
  notImplemented: boolean;
  scannedPdfWarning: boolean;
  importedCount: number | null;
};

const INITIAL_STATE: GbmImportState = {
  status: "idle",
  rows: [],
  previewId: null,
  selectedRowIds: new Set(),
  error: null,
  notImplemented: false,
  scannedPdfWarning: false,
  importedCount: null,
};

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function useGbmImport(docType: GbmDocType) {
  const [state, setState] = useState<GbmImportState>(INITIAL_STATE);

  const summary = useMemo(
    () => ({
      newCount: state.rows.filter((row) => row.status === "NEW").length,
      duplicateCount: state.rows.filter((row) => row.status === "DUPLICATE").length,
      errorCount: state.rows.filter((row) => row.status === "ERROR").length,
    }),
    [state.rows],
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const selectFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      if (files.some((file) => !isPdfFile(file))) {
        setState({ ...INITIAL_STATE, error: "Solo se permiten archivos PDF." });
        return;
      }

      setState({ ...INITIAL_STATE, status: "loading" });

      try {
        const response = await previewImport(docType, files);
        const selectedRowIds = new Set(
          response.rows.filter((row) => row.status === "NEW").map((row) => row.rowId),
        );

        setState({
          ...INITIAL_STATE,
          status: "previewed",
          rows: response.rows,
          previewId: response.previewId,
          selectedRowIds,
        });
      } catch (requestError) {
        if (requestError instanceof ApiError) {
          if (requestError.status === 501) {
            setState({ ...INITIAL_STATE, notImplemented: true });
            return;
          }

          if (requestError.status === 422 && requestError.problem?.errorCode === SCANNED_PDF_ERROR_CODE) {
            setState({ ...INITIAL_STATE, scannedPdfWarning: true });
            return;
          }

          setState({ ...INITIAL_STATE, error: getProblemMessage(requestError) });
          return;
        }

        setState({
          ...INITIAL_STATE,
          error: requestError instanceof Error ? requestError.message : "No se pudo procesar el archivo.",
        });
      }
    },
    [docType],
  );

  const toggleRow = useCallback((rowId: string) => {
    setState((current) => {
      const row = current.rows.find((candidate) => candidate.rowId === rowId);
      if (!row || row.status !== "NEW") return current;

      const selectedRowIds = new Set(current.selectedRowIds);
      if (selectedRowIds.has(rowId)) {
        selectedRowIds.delete(rowId);
      } else {
        selectedRowIds.add(rowId);
      }

      return { ...current, selectedRowIds };
    });
  }, []);

  const confirmSelected = useCallback(
    async (onConfirmed?: () => void) => {
      if (!state.previewId || state.selectedRowIds.size === 0) return;

      setState((current) => ({ ...current, status: "confirming", error: null }));

      try {
        const response = await confirmImport({
          previewId: state.previewId,
          rowIds: Array.from(state.selectedRowIds),
        });

        setState((current) => ({ ...current, status: "confirmed", importedCount: response.importedCount }));
        onConfirmed?.();
      } catch (requestError) {
        const message =
          requestError instanceof ApiError
            ? getProblemMessage(requestError)
            : requestError instanceof Error
              ? requestError.message
              : "No se pudo importar la selección.";

        setState((current) => ({ ...current, status: "previewed", error: message }));
      }
    },
    [state.previewId, state.selectedRowIds],
  );

  return { state, summary, selectFiles, toggleRow, confirmSelected, reset };
}
