import { apiRequest, apiUpload } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  GbmDocType,
  ImportConfirmRequest,
  ImportConfirmResponse,
  ImportPreviewResponse,
} from "@/features/import/types/import.types";

export function previewImport(docType: GbmDocType, files: File[]) {
  const formData = new FormData();
  formData.append("docType", docType);
  files.forEach((file) => formData.append("files", file));

  return apiUpload<ImportPreviewResponse>(endpoints.import.preview, formData, {
    method: "POST",
    auth: true,
  });
}

export function confirmImport(payload: ImportConfirmRequest) {
  return apiRequest<ImportConfirmResponse>(endpoints.import.confirm, {
    method: "POST",
    auth: true,
    body: payload,
  });
}
