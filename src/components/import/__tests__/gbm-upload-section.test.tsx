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
    uploading: { statement: false, confirmations: false },
    uploadError: { statement: null, confirmations: null },
    retryErrors: {},
    loadingRecent: false,
    stalled: false,
    uploadStatement: vi.fn(),
    uploadConfirmations: vi.fn(),
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

  it("forwards a chosen statement PDF to uploadStatement()", async () => {
    const uploadStatement = vi.fn();
    mockedUseGbmImport.mockReturnValue(hookState({ uploadStatement }));

    render(<GbmUploadSection />);
    const file = new File(["%PDF-1.4"], "estado-cuenta.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByTestId("gbm-channel-statement-input"), file);

    expect(uploadStatement).toHaveBeenCalledTimes(1);
    expect(uploadStatement.mock.calls[0][0]).toBeInstanceOf(File);
  });

  it("forwards chosen confirmation PDFs to uploadConfirmations()", async () => {
    const uploadConfirmations = vi.fn();
    mockedUseGbmImport.mockReturnValue(hookState({ uploadConfirmations }));

    render(<GbmUploadSection />);
    const files = [
      new File(["%PDF-1.4"], "dw-1.pdf", { type: "application/pdf" }),
      new File(["%PDF-1.4"], "dw-2.pdf", { type: "application/pdf" }),
    ];
    await userEvent.upload(screen.getByTestId("gbm-channel-drivewealth-input"), files);

    expect(uploadConfirmations).toHaveBeenCalledTimes(1);
    expect(uploadConfirmations.mock.calls[0][0]).toHaveLength(2);
  });

  it("renders a channel upload error", () => {
    mockedUseGbmImport.mockReturnValue(
      hookState({ uploadError: { statement: "Solo se permiten archivos PDF.", confirmations: null } }),
    );
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
