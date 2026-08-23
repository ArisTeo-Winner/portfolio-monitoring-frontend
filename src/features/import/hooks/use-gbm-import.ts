"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, getProblemMessage } from "@/lib/api/problem-details";
import {
  getImportJob,
  listImportJobs,
  retryImportJob,
  uploadBrokerDocuments,
} from "@/features/import/api/import-broker-documents";
import { isTerminal, type ImportJob } from "@/features/import/types/import.types";

export const POLL_INTERVAL_MS = 2000;
// Safety net: stop polling a still-running job after this long so a stuck
// backend job never keeps the client polling forever.
export const POLL_TIMEOUT_MS = 120_000;

type Options = {
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
};

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/**
 * Prefer the backend's curated problem+json `detail` (per the brief), falling
 * back to the status-based localized message. Raw non-JSON errors are never
 * ProblemDetails, so they fall through to the safe localized copy.
 */
function messageFromError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.problem?.detail?.trim() || getProblemMessage(error);
  }
  return error instanceof Error ? error.message : fallback;
}

function sortByNewest(a: ImportJob, b: ImportJob) {
  return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
}

export function useGbmImport(options: Options = {}) {
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const pollTimeoutMs = options.pollTimeoutMs ?? POLL_TIMEOUT_MS;

  const [jobsById, setJobsById] = useState<Record<string, ImportJob>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [retryErrors, setRetryErrors] = useState<Record<string, string>>({});
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [stalled, setStalled] = useState(false);
  // Bumped to force the polling effect to restart (e.g. after a manual refresh
  // once polling has been stopped by the safety timeout).
  const [pollNonce, setPollNonce] = useState(0);

  const jobs = useMemo(
    () => order.map((id) => jobsById[id]).filter((job): job is ImportJob => Boolean(job)),
    [order, jobsById],
  );

  const activeIds = useMemo(
    () => order.filter((id) => jobsById[id] && !isTerminal(jobsById[id])),
    [order, jobsById],
  );
  // Stable identity for the *set* of active jobs, so the polling effect only
  // restarts when the set changes — not on every status tick.
  const activeKey = useMemo(() => [...activeIds].sort().join(","), [activeIds]);

  const mergeJobs = useCallback((incoming: ImportJob[], prepend = false) => {
    if (incoming.length === 0) return;
    setJobsById((prev) => {
      const next = { ...prev };
      for (const job of incoming) next[job.jobId] = job;
      return next;
    });
    setOrder((prev) => {
      const known = new Set(prev);
      const fresh = incoming.map((job) => job.jobId).filter((id) => !known.has(id));
      return prepend ? [...fresh, ...prev] : [...prev, ...fresh];
    });
  }, []);

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const recent = await listImportJobs();
      const sorted = [...recent].sort(sortByNewest);
      setJobsById(Object.fromEntries(sorted.map((job) => [job.jobId, job])));
      setOrder(sorted.map((job) => job.jobId));
    } catch {
      // Recent-uploads history is non-critical; a fresh upload still works.
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  const upload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    if (files.some((file) => !isPdfFile(file))) {
      setUploadError("Solo se permiten archivos PDF.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const created = await uploadBrokerDocuments(files);
      mergeJobs([...created].sort(sortByNewest), true);
      setStalled(false);
    } catch (error) {
      setUploadError(messageFromError(error, "No se pudieron subir los archivos."));
    } finally {
      setUploading(false);
    }
  }, [mergeJobs]);

  const retry = useCallback(async (jobId: string) => {
    setRetryErrors((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
    try {
      const requeued = await retryImportJob(jobId);
      mergeJobs([requeued]);
      setStalled(false);
      setPollNonce((n) => n + 1);
    } catch (error) {
      setRetryErrors((prev) => ({
        ...prev,
        [jobId]: messageFromError(error, "No se pudo reintentar la carga."),
      }));
    }
  }, [mergeJobs]);

  // Manual re-poll after the safety timeout stopped polling.
  const refresh = useCallback(() => {
    setStalled(false);
    setPollNonce((n) => n + 1);
  }, []);

  // ── Polling loop ────────────────────────────────────────────────────────────
  const activeIdsRef = useRef(activeIds);
  activeIdsRef.current = activeIds;

  useEffect(() => {
    if (activeIds.length === 0) return;

    const startedAt = Date.now();
    let disposed = false;

    const tick = async () => {
      if (disposed) return;
      if (Date.now() - startedAt >= pollTimeoutMs) {
        setStalled(true);
        clearInterval(timer);
        return;
      }
      const ids = activeIdsRef.current;
      await Promise.all(
        ids.map(async (id) => {
          try {
            const updated = await getImportJob(id);
            if (!disposed) mergeJobs([updated]);
          } catch {
            // Transient poll failure — keep polling; a later tick may succeed.
          }
        }),
      );
    };

    // `tick` closes over `timer`; the interval never fires before this line
    // runs, so the reference is always resolved by the time `tick` executes.
    const timer = setInterval(() => void tick(), pollIntervalMs);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
    // Restart only when the active set changes or a manual refresh is requested.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, pollNonce, pollIntervalMs, pollTimeoutMs, mergeJobs]);

  return {
    jobs,
    activeCount: activeIds.length,
    uploading,
    uploadError,
    retryErrors,
    loadingRecent,
    stalled,
    upload,
    retry,
    refresh,
    loadRecent,
  };
}
