import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  SplitPreviewRequest,
  SplitPreviewResponse,
} from "@/features/portfolio/types/split-preview.types";

// POST (not GET) on purpose: quantity/pricePerUnit are financial data and must
// never travel in a URL/query string (CLAUDE.md §6 DevSecOps). The body carries
// them instead. Read-only on the backend — nothing is persisted.
export function getSplitPreview(
  request: SplitPreviewRequest,
  signal?: AbortSignal,
): Promise<SplitPreviewResponse> {
  return apiRequest<SplitPreviewResponse>(endpoints.portfolio.splitPreview, {
    method: "POST",
    auth: true,
    body: request,
    signal,
  });
}
