import { apiRequest, apiUpload } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { ImportJob } from "@/features/import/types/import.types";

/**
 * Uploads 1..N PDFs for broker auto-detection. Returns 202 with one job per
 * file. The multipart field name is `files` (repeated per file); the browser
 * sets the multipart Content-Type/boundary itself (see apiUpload).
 */
export function uploadBrokerDocuments(files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  return apiUpload<ImportJob[]>(endpoints.brokerImport.upload, formData, {
    method: "POST",
    auth: true,
  });
}

/** Polls a single import job's current state. */
export function getImportJob(jobId: string) {
  return apiRequest<ImportJob>(endpoints.brokerImport.job(jobId), { auth: true });
}

/** Lists the authenticated user's recent import jobs (newest first). */
export function listImportJobs() {
  return apiRequest<ImportJob[]>(endpoints.brokerImport.jobs, { auth: true });
}

/** Re-queues a job that reached DEAD_LETTER. Returns the re-queued job. */
export function retryImportJob(jobId: string) {
  return apiRequest<ImportJob>(endpoints.brokerImport.retry(jobId), {
    method: "POST",
    auth: true,
  });
}
