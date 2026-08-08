import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GbmUploadSection } from "../gbm-upload-section";
import { useGbmImport } from "@/features/import/hooks/use-gbm-import";

vi.mock("@/features/import/hooks/use-gbm-import", () => ({
  useGbmImport: vi.fn(),
}));

const mockedUseGbmImport = vi.mocked(useGbmImport);

const BASE_HOOK_RETURN = {
  state: {
    status: "idle" as const,
    rows: [],
    previewId: null,
    selectedRowIds: new Set<string>(),
    error: null,
    notImplemented: false,
    scannedPdfWarning: false,
    importedCount: null,
  },
  summary: { newCount: 0, duplicateCount: 0, errorCount: 0 },
  selectFiles: vi.fn(),
  toggleRow: vi.fn(),
  confirmSelected: vi.fn(),
  reset: vi.fn(),
};

describe("GbmUploadSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseGbmImport.mockReturnValue(BASE_HOOK_RETURN);
  });

  it("configures the file input as single-select .pdf for the monthly statement button", () => {
    render(
      <GbmUploadSection
        docType="GBM_MONTHLY_STATEMENT"
        multiple={false}
        subtitle="Para Smart Cash y Trading México"
        testId="gbm-monthly-statement"
        title="Cargar Estado de Cuenta Mensual (.pdf)"
      />,
    );

    const input = screen.getByTestId("gbm-monthly-statement-input");
    expect(input).toHaveAttribute("accept", ".pdf");
    expect(input).not.toHaveAttribute("multiple");
  });

  it("configures the file input as multi-select .pdf for the DriveWealth button", () => {
    render(
      <GbmUploadSection
        docType="DRIVEWEALTH_CONFIRMATION"
        multiple
        subtitle="Para Trading Global / USA — Permite selección múltiple"
        testId="gbm-drivewealth-confirmation"
        title="Cargar Confirmaciones DriveWealth (.pdf)"
      />,
    );

    const input = screen.getByTestId("gbm-drivewealth-confirmation-input");
    expect(input).toHaveAttribute("multiple");
  });

  it("clicking the button opens the hidden file picker", async () => {
    const user = userEvent.setup();
    render(
      <GbmUploadSection
        docType="DRIVEWEALTH_CONFIRMATION"
        multiple
        subtitle="subtitle"
        testId="gbm-drivewealth-confirmation"
        title="Cargar"
      />,
    );

    const input = screen.getByTestId("gbm-drivewealth-confirmation-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");

    await user.click(screen.getByTestId("gbm-drivewealth-confirmation-trigger"));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("renders the Próximamente panel when notImplemented is true", () => {
    mockedUseGbmImport.mockReturnValue({
      ...BASE_HOOK_RETURN,
      state: { ...BASE_HOOK_RETURN.state, notImplemented: true },
    });

    render(
      <GbmUploadSection docType="GBM_MONTHLY_STATEMENT" multiple={false} subtitle="s" testId="t" title="Cargar" />,
    );

    expect(screen.getByTestId("gbm-import-coming-soon")).toBeInTheDocument();
  });

  it("renders the scanned-PDF message when scannedPdfWarning is true", () => {
    mockedUseGbmImport.mockReturnValue({
      ...BASE_HOOK_RETURN,
      state: { ...BASE_HOOK_RETURN.state, scannedPdfWarning: true },
    });

    render(
      <GbmUploadSection docType="DRIVEWEALTH_CONFIRMATION" multiple subtitle="s" testId="t" title="Cargar" />,
    );

    expect(screen.getByText(/PDF escaneado/)).toBeInTheDocument();
  });

  it("disables the confirm button when nothing is selected", () => {
    mockedUseGbmImport.mockReturnValue({
      ...BASE_HOOK_RETURN,
      state: {
        ...BASE_HOOK_RETURN.state,
        status: "previewed",
        rows: [
          {
            rowId: "r1",
            assetSymbol: "AAPL",
            assetType: "STOCK",
            quantity: 1,
            pricePerUnit: 100,
            transactionDate: "2026-01-01",
            status: "NEW",
          },
        ],
      },
    });

    render(
      <GbmUploadSection docType="DRIVEWEALTH_CONFIRMATION" multiple subtitle="s" testId="t" title="Cargar" />,
    );

    expect(screen.getByTestId("t-confirm")).toBeDisabled();
  });

  it("shows the success message with importedCount when confirmed", () => {
    mockedUseGbmImport.mockReturnValue({
      ...BASE_HOOK_RETURN,
      state: { ...BASE_HOOK_RETURN.state, status: "confirmed", importedCount: 3 },
    });

    render(
      <GbmUploadSection docType="DRIVEWEALTH_CONFIRMATION" multiple subtitle="s" testId="t" title="Cargar" />,
    );

    expect(screen.getByTestId("t-success")).toHaveTextContent("3 transacciones importadas correctamente.");
  });
});
