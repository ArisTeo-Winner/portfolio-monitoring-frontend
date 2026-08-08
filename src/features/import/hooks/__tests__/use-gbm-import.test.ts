import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useGbmImport } from "../use-gbm-import";
import { confirmImport, previewImport } from "@/features/import/api/import-broker-documents";
import { ApiError } from "@/lib/api/problem-details";
import { SCANNED_PDF_ERROR_CODE, type ImportPreviewResponse } from "@/features/import/types/import.types";

vi.mock("@/features/import/api/import-broker-documents", () => ({
  previewImport: vi.fn(),
  confirmImport: vi.fn(),
}));

const mockedPreviewImport = vi.mocked(previewImport);
const mockedConfirmImport = vi.mocked(confirmImport);

function pdfFile(name = "statement.pdf") {
  return new File(["%PDF-1.4"], name, { type: "application/pdf" });
}

const PREVIEW_RESPONSE: ImportPreviewResponse = {
  previewId: "preview-1",
  docType: "DRIVEWEALTH_CONFIRMATION",
  rows: [
    { rowId: "r1", assetSymbol: "AAPL", assetType: "STOCK", quantity: 1, pricePerUnit: 100, transactionDate: "2026-01-01", status: "NEW" },
    { rowId: "r2", assetSymbol: "MSFT", assetType: "STOCK", quantity: 2, pricePerUnit: 200, transactionDate: "2026-01-02", status: "DUPLICATE", statusReason: "Ya existe" },
    { rowId: "r3", assetSymbol: "TSLA", assetType: "STOCK", quantity: 3, pricePerUnit: 300, transactionDate: "2026-01-03", status: "ERROR", statusReason: "Precio inválido" },
  ],
};

describe("useGbmImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-PDF files client-side without calling previewImport", async () => {
    const { result } = renderHook(() => useGbmImport("DRIVEWEALTH_CONFIRMATION"));

    await act(async () => {
      await result.current.selectFiles([new File(["x"], "statement.txt", { type: "text/plain" })]);
    });

    expect(mockedPreviewImport).not.toHaveBeenCalled();
    expect(result.current.state.error).toBe("Solo se permiten archivos PDF.");
  });

  it("previews successfully and pre-selects only NEW rows", async () => {
    mockedPreviewImport.mockResolvedValue(PREVIEW_RESPONSE);
    const { result } = renderHook(() => useGbmImport("DRIVEWEALTH_CONFIRMATION"));

    await act(async () => {
      await result.current.selectFiles([pdfFile()]);
    });

    expect(result.current.state.status).toBe("previewed");
    expect(result.current.state.rows).toEqual(PREVIEW_RESPONSE.rows);
    expect(result.current.state.selectedRowIds).toEqual(new Set(["r1"]));
    expect(result.current.summary).toEqual({ newCount: 1, duplicateCount: 1, errorCount: 1 });
  });

  it("does not allow toggling a DUPLICATE or ERROR row", async () => {
    mockedPreviewImport.mockResolvedValue(PREVIEW_RESPONSE);
    const { result } = renderHook(() => useGbmImport("DRIVEWEALTH_CONFIRMATION"));

    await act(async () => {
      await result.current.selectFiles([pdfFile()]);
    });

    act(() => {
      result.current.toggleRow("r2");
    });

    expect(result.current.state.selectedRowIds.has("r2")).toBe(false);
  });

  it("sets notImplemented on a 501 response", async () => {
    mockedPreviewImport.mockRejectedValue(new ApiError(501, "Not implemented"));
    const { result } = renderHook(() => useGbmImport("GBM_MONTHLY_STATEMENT"));

    await act(async () => {
      await result.current.selectFiles([pdfFile()]);
    });

    expect(result.current.state.notImplemented).toBe(true);
    expect(result.current.state.status).toBe("idle");
  });

  it("sets scannedPdfWarning on a 422 SCANNED_PDF response", async () => {
    mockedPreviewImport.mockRejectedValue(
      new ApiError(422, "Unprocessable", { status: 422, errorCode: SCANNED_PDF_ERROR_CODE }),
    );
    const { result } = renderHook(() => useGbmImport("DRIVEWEALTH_CONFIRMATION"));

    await act(async () => {
      await result.current.selectFiles([pdfFile()]);
    });

    expect(result.current.state.scannedPdfWarning).toBe(true);
  });

  it("sets a generic error message for other failures", async () => {
    mockedPreviewImport.mockRejectedValue(new ApiError(500, "Server error"));
    const { result } = renderHook(() => useGbmImport("DRIVEWEALTH_CONFIRMATION"));

    await act(async () => {
      await result.current.selectFiles([pdfFile()]);
    });

    expect(result.current.state.error).toBe("Server error");
  });

  it("confirms only selected NEW rowIds and fires onConfirmed", async () => {
    mockedPreviewImport.mockResolvedValue(PREVIEW_RESPONSE);
    mockedConfirmImport.mockResolvedValue({ importedCount: 1 });
    const onConfirmed = vi.fn();
    const { result } = renderHook(() => useGbmImport("DRIVEWEALTH_CONFIRMATION"));

    await act(async () => {
      await result.current.selectFiles([pdfFile()]);
    });

    await act(async () => {
      await result.current.confirmSelected(onConfirmed);
    });

    expect(mockedConfirmImport).toHaveBeenCalledWith({ previewId: "preview-1", rowIds: ["r1"] });
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe("confirmed");
    expect(result.current.state.importedCount).toBe(1);
  });

  it("reset returns to idle state", async () => {
    mockedPreviewImport.mockResolvedValue(PREVIEW_RESPONSE);
    const { result } = renderHook(() => useGbmImport("DRIVEWEALTH_CONFIRMATION"));

    await act(async () => {
      await result.current.selectFiles([pdfFile()]);
    });

    act(() => {
      result.current.reset();
    });

    await waitFor(() => expect(result.current.state.status).toBe("idle"));
    expect(result.current.state.rows).toEqual([]);
  });
});
