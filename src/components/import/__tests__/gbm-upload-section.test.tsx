import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GbmUploadSection } from "@/components/import/gbm-upload-section";
import { useGbmImport } from "@/features/import/hooks/use-gbm-import";
import type { ImportJob } from "@/features/import/types/import.types";

vi.mock("@/features/import/hooks/use-gbm-import", () => ({
  useGbmImport: vi.fn(),
}));

const mockedUseGbmImport = vi.mocked(useGbmImport);

type HookReturn = ReturnType<typeof useGbmImport>;

function hookState(overrides: Partial<HookReturn> = {}): HookReturn {
  return {
    jobs: [],
    activeCount: 0,
    uploading: false,
    uploadError: null,
    retryErrors: {},
    loadingRecent: false,
    stalled: false,
    upload: vi.fn(),
    retry: vi.fn(),
    refresh: vi.fn(),
    loadRecent: vi.fn(),
    ...overrides,
  };
}

function job(overrides: Partial<ImportJob> = {}): ImportJob {
  return {
    jobId: "j1",
    fileName: "statement.pdf",
    jobType: null,
    status: "COMPLETED",
    result: { fileName: "statement.pdf", accepted: 2, duplicate: 0, skipped: 0, rejected: 0, messages: [] },
    errorMessage: null,
    attemptCount: 0,
    createdAt: "2026-08-22T10:00:00Z",
    completedAt: "2026-08-22T10:01:00Z",
    ...overrides,
  };
}

describe("GbmUploadSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the empty state and calls loadRecent on mount", () => {
    const loadRecent = vi.fn();
    mockedUseGbmImport.mockReturnValue(hookState({ loadRecent }));

    render(<GbmUploadSection />);

    expect(loadRecent).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("import-jobs-empty")).toBeInTheDocument();
  });

  it("forwards chosen files to upload()", async () => {
    const upload = vi.fn();
    mockedUseGbmImport.mockReturnValue(hookState({ upload }));

    render(<GbmUploadSection />);
    const file = new File(["%PDF-1.4"], "statement.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByTestId("gbm-import-input"), file);

    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0]).toHaveLength(1);
  });

  it("renders the upload error via ProblemAlert", () => {
    mockedUseGbmImport.mockReturnValue(hookState({ uploadError: "Solo se permiten archivos PDF." }));
    render(<GbmUploadSection />);
    expect(screen.getByText("Solo se permiten archivos PDF.")).toBeInTheDocument();
  });

  it("renders a job card per job", () => {
    mockedUseGbmImport.mockReturnValue(
      hookState({ jobs: [job({ jobId: "a" }), job({ jobId: "b", status: "DEAD_LETTER", result: null, errorMessage: "x" })] }),
    );
    render(<GbmUploadSection />);
    expect(screen.getAllByTestId("import-job-card")).toHaveLength(2);
  });

  it("shows the stalled banner and wires the refresh button", async () => {
    const refresh = vi.fn();
    mockedUseGbmImport.mockReturnValue(hookState({ stalled: true, refresh, jobs: [job({ status: "PROCESSING", result: null })] }));

    render(<GbmUploadSection />);
    expect(screen.getByTestId("import-poll-stalled")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("import-refresh"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("calls onImported once per completed job with accepted rows", () => {
    const onImported = vi.fn();
    mockedUseGbmImport.mockReturnValue(hookState({ jobs: [job({ jobId: "a", result: { fileName: "a", accepted: 2, duplicate: 0, skipped: 0, rejected: 0, messages: [] } })] }));

    render(<GbmUploadSection onImported={onImported} />);
    expect(onImported).toHaveBeenCalledTimes(1);
  });
});
