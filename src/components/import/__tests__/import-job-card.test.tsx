import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ImportJobCard } from "@/components/import/import-job-card";
import type { ImportJob } from "@/features/import/types/import.types";

// The review panel fetches transactions on mount; stub it so job-card tests stay
// isolated from the transactions API.
vi.mock("@/components/import/import-review-panel", () => ({
  ImportReviewPanel: () => <div data-testid="import-review-panel-stub" />,
}));

function job(overrides: Partial<ImportJob> = {}): ImportJob {
  return {
    jobId: "j1",
    fileName: "estado-cuenta.pdf",
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

describe("ImportJobCard", () => {
  it("shows a processing spinner and status while the job is running", () => {
    render(<ImportJobCard job={job({ status: "PROCESSING" })} onRetry={vi.fn()} />);
    expect(screen.getByTestId("import-job-status")).toHaveTextContent("Procesando…");
    expect(screen.queryByTestId("import-job-retry")).not.toBeInTheDocument();
  });

  it("shows accepted count and extra counts when COMPLETED", () => {
    render(
      <ImportJobCard
        job={job({
          status: "COMPLETED",
          result: { fileName: "estado-cuenta.pdf", accepted: 3, duplicate: 2, skipped: 0, rejected: 1, messages: ["Fila 4 sin precio"] },
        })}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByTestId("import-job-accepted")).toHaveTextContent("3 transacciones importadas");
    expect(screen.getByTestId("import-job-status")).toHaveTextContent("2 duplicadas");
    expect(screen.getByTestId("import-job-status")).toHaveTextContent("1 rechazada");
    expect(screen.getByText("Fila 4 sin precio")).toBeInTheDocument();
  });

  it("shows the error message and a retry button when DEAD_LETTER", async () => {
    const onRetry = vi.fn();
    render(
      <ImportJobCard job={job({ status: "DEAD_LETTER", errorMessage: "Formato no reconocido." })} onRetry={onRetry} />,
    );
    expect(screen.getByTestId("import-job-error")).toHaveTextContent("Formato no reconocido.");

    await userEvent.click(screen.getByTestId("import-job-retry"));
    expect(onRetry).toHaveBeenCalledWith("j1");
  });

  it("falls back to a generic message when DEAD_LETTER has no errorMessage", () => {
    render(<ImportJobCard job={job({ status: "DEAD_LETTER", errorMessage: null })} onRetry={vi.fn()} />);
    expect(screen.getByTestId("import-job-error")).toHaveTextContent("No se pudo procesar el archivo.");
  });

  it("shows the retry error next to the button when a retry fails", () => {
    render(
      <ImportJobCard
        job={job({ status: "DEAD_LETTER", errorMessage: "boom" })}
        onRetry={vi.fn()}
        retryError="Demasiados reintentos."
      />,
    );
    expect(screen.getByTestId("import-job-retry-error")).toHaveTextContent("Demasiados reintentos.");
  });

  it("offers a review toggle for a completed job with accepted rows and reveals the panel", async () => {
    render(
      <ImportJobCard
        job={job({
          status: "COMPLETED",
          result: { fileName: "dw.pdf", accepted: 2, duplicate: 0, skipped: 0, rejected: 0, messages: [] },
        })}
        onRetry={vi.fn()}
      />,
    );

    const toggle = screen.getByTestId("import-job-review-toggle");
    expect(screen.queryByTestId("import-review-panel-stub")).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.getByTestId("import-review-panel-stub")).toBeInTheDocument();
  });

  it("hides the review toggle when the job imported zero rows", () => {
    render(
      <ImportJobCard
        job={job({
          status: "COMPLETED",
          result: { fileName: "dw.pdf", accepted: 0, duplicate: 3, skipped: 0, rejected: 0, messages: [] },
        })}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("import-job-review-toggle")).not.toBeInTheDocument();
  });
});
