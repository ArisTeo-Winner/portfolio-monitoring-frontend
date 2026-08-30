import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useGbmImport } from "../use-gbm-import";
import {
  getImportJob,
  listImportJobs,
  retryImportJob,
  uploadDriveWealthConfirmations,
  uploadMonthlyStatement,
} from "@/features/import/api/import-broker-documents";
import { ApiError } from "@/lib/api/problem-details";
import type { ImportJob } from "@/features/import/types/import.types";

vi.mock("@/features/import/api/import-broker-documents", () => ({
  uploadMonthlyStatement: vi.fn(),
  uploadDriveWealthConfirmations: vi.fn(),
  getImportJob: vi.fn(),
  listImportJobs: vi.fn(),
  retryImportJob: vi.fn(),
}));

const mockedUploadStatement = vi.mocked(uploadMonthlyStatement);
const mockedUploadConfirmations = vi.mocked(uploadDriveWealthConfirmations);
const mockedGetJob = vi.mocked(getImportJob);
const mockedListJobs = vi.mocked(listImportJobs);
const mockedRetry = vi.mocked(retryImportJob);

function pdfFile(name = "statement.pdf") {
  return new File(["%PDF-1.4"], name, { type: "application/pdf" });
}

function job(overrides: Partial<ImportJob> = {}): ImportJob {
  return {
    jobId: "j1",
    fileName: "statement.pdf",
    jobType: "GBM_MONTHLY_STATEMENT",
    status: "QUEUED",
    result: null,
    errorMessage: null,
    attemptCount: 0,
    createdAt: "2026-08-22T10:00:00Z",
    completedAt: null,
    ...overrides,
  };
}

describe("useGbmImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects non-PDF files client-side without calling the upload endpoint", async () => {
    const { result } = renderHook(() => useGbmImport());

    await act(async () => {
      await result.current.uploadConfirmations([new File(["x"], "note.txt", { type: "text/plain" })]);
    });

    expect(mockedUploadConfirmations).not.toHaveBeenCalled();
    expect(result.current.uploadError.confirmations).toBe("Solo se permiten archivos PDF.");
  });

  it("uploads a monthly statement (single job) and polls it to COMPLETED", async () => {
    mockedUploadStatement.mockResolvedValue(job({ status: "QUEUED", jobType: "GBM_MONTHLY_STATEMENT" }));
    mockedGetJob.mockResolvedValueOnce(
      job({
        status: "COMPLETED",
        result: { fileName: "statement.pdf", accepted: 4, duplicate: 0, skipped: 0, rejected: 0, messages: [] },
      }),
    );

    const { result } = renderHook(() => useGbmImport());
    await act(async () => {
      await result.current.uploadStatement(pdfFile());
    });
    expect(mockedUploadStatement).toHaveBeenCalledTimes(1);
    expect(result.current.jobs[0].status).toBe("QUEUED");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.jobs[0].status).toBe("COMPLETED");
    expect(result.current.jobs[0].result?.accepted).toBe(4);
  });

  it("uploads, then polls each job until COMPLETED and stops at the terminal state", async () => {
    mockedUploadConfirmations.mockResolvedValue([job({ status: "QUEUED" })]);
    mockedGetJob
      .mockResolvedValueOnce(job({ status: "PROCESSING" }))
      .mockResolvedValueOnce(
        job({
          status: "COMPLETED",
          completedAt: "2026-08-22T10:01:00Z",
          result: { fileName: "statement.pdf", accepted: 3, duplicate: 1, skipped: 0, rejected: 0, messages: [] },
        }),
      );

    const { result } = renderHook(() => useGbmImport());

    await act(async () => {
      await result.current.uploadConfirmations([pdfFile()]);
    });
    expect(result.current.jobs[0].status).toBe("QUEUED");

    // Tick 1 -> PROCESSING
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.jobs[0].status).toBe("PROCESSING");

    // Tick 2 -> COMPLETED (terminal -> polling stops)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.jobs[0].status).toBe("COMPLETED");
    expect(result.current.jobs[0].result?.accepted).toBe(3);
    expect(result.current.activeCount).toBe(0);

    const callsAfterTerminal = mockedGetJob.mock.calls.length;
    // No further polling once terminal.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });
    expect(mockedGetJob.mock.calls.length).toBe(callsAfterTerminal);
  });

  it("stops polling when a job reaches DEAD_LETTER and exposes its error", async () => {
    mockedUploadConfirmations.mockResolvedValue([job({ status: "QUEUED" })]);
    mockedGetJob.mockResolvedValueOnce(
      job({ status: "DEAD_LETTER", errorMessage: "Formato de PDF no reconocido." }),
    );

    const { result } = renderHook(() => useGbmImport());
    await act(async () => {
      await result.current.uploadConfirmations([pdfFile()]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(result.current.jobs[0].status).toBe("DEAD_LETTER");
    expect(result.current.jobs[0].errorMessage).toBe("Formato de PDF no reconocido.");
    expect(result.current.activeCount).toBe(0);
  });

  it("retries a DEAD_LETTER job and resumes polling to COMPLETED", async () => {
    mockedUploadConfirmations.mockResolvedValue([job({ status: "QUEUED" })]);
    mockedGetJob.mockResolvedValueOnce(job({ status: "DEAD_LETTER", errorMessage: "boom" }));
    mockedRetry.mockResolvedValue(job({ status: "QUEUED", attemptCount: 1 }));

    const { result } = renderHook(() => useGbmImport());
    await act(async () => {
      await result.current.uploadConfirmations([pdfFile()]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.jobs[0].status).toBe("DEAD_LETTER");

    mockedGetJob.mockResolvedValueOnce(
      job({ status: "COMPLETED", result: { fileName: "statement.pdf", accepted: 2, duplicate: 0, skipped: 0, rejected: 0, messages: [] } }),
    );

    await act(async () => {
      await result.current.retry("j1");
    });
    expect(mockedRetry).toHaveBeenCalledWith("j1");
    expect(result.current.jobs[0].status).toBe("QUEUED");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.jobs[0].status).toBe("COMPLETED");
  });

  it("surfaces the problem+json detail as the retry error when retry fails", async () => {
    mockedUploadConfirmations.mockResolvedValue([job({ status: "QUEUED" })]);
    mockedGetJob.mockResolvedValueOnce(job({ status: "DEAD_LETTER", errorMessage: "boom" }));
    mockedRetry.mockRejectedValue(
      new ApiError(429, "Too many requests", { status: 429, detail: "Demasiados reintentos, espera un momento." }),
    );

    const { result } = renderHook(() => useGbmImport());
    await act(async () => {
      await result.current.uploadConfirmations([pdfFile()]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await act(async () => {
      await result.current.retry("j1");
    });

    expect(result.current.retryErrors["j1"]).toBe("Demasiados reintentos, espera un momento.");
  });

  it("loadRecent populates the jobs list newest-first", async () => {
    mockedListJobs.mockResolvedValue([
      job({ jobId: "old", createdAt: "2026-08-20T10:00:00Z", status: "COMPLETED", result: { fileName: "a.pdf", accepted: 1, duplicate: 0, skipped: 0, rejected: 0, messages: [] } }),
      job({ jobId: "new", createdAt: "2026-08-22T10:00:00Z", status: "COMPLETED", result: { fileName: "b.pdf", accepted: 1, duplicate: 0, skipped: 0, rejected: 0, messages: [] } }),
    ]);

    const { result } = renderHook(() => useGbmImport());
    await act(async () => {
      await result.current.loadRecent();
    });

    expect(result.current.jobs.map((j) => j.jobId)).toEqual(["new", "old"]);
  });

  it("stops polling and flags stalled after the safety timeout", async () => {
    mockedUploadConfirmations.mockResolvedValue([job({ status: "QUEUED" })]);
    mockedGetJob.mockResolvedValue(job({ status: "PROCESSING" }));

    const { result } = renderHook(() => useGbmImport({ pollIntervalMs: 1000, pollTimeoutMs: 3000 }));
    await act(async () => {
      await result.current.uploadConfirmations([pdfFile()]);
    });

    // Advance past the safety timeout while the job never finishes.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.stalled).toBe(true);
    const callsAtStall = mockedGetJob.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(mockedGetJob.mock.calls.length).toBe(callsAtStall);
  });
});
