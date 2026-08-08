import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { PreviewTable } from "../preview-table";
import type { ImportPreviewRow } from "@/features/import/types/import.types";

const ROWS: ImportPreviewRow[] = [
  { rowId: "r1", assetSymbol: "AAPL", assetType: "STOCK", quantity: 1, pricePerUnit: 100, transactionDate: "2026-01-01", status: "NEW" },
  { rowId: "r2", assetSymbol: "MSFT", assetType: "STOCK", quantity: 2, pricePerUnit: 200, transactionDate: "2026-01-02", status: "DUPLICATE", statusReason: "Ya existe" },
  { rowId: "r3", assetSymbol: "TSLA", assetType: "STOCK", quantity: 3, pricePerUnit: 300, transactionDate: "2026-01-03", status: "ERROR", statusReason: "Precio inválido" },
];

describe("PreviewTable", () => {
  it("renders one row per preview row with symbol and status label", () => {
    render(<PreviewTable rows={ROWS} selectedRowIds={new Set(["r1"])} onToggle={vi.fn()} />);

    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("MSFT")).toBeInTheDocument();
    expect(screen.getByText("TSLA")).toBeInTheDocument();
    expect(screen.getByText("Nueva")).toBeInTheDocument();
    expect(screen.getByText("Duplicada")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("checks only the NEW row that is in selectedRowIds", () => {
    render(<PreviewTable rows={ROWS} selectedRowIds={new Set(["r1"])} onToggle={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: /AAPL/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /MSFT/ })).not.toBeChecked();
  });

  it("disables the checkbox for DUPLICATE and ERROR rows with a tooltip", () => {
    render(<PreviewTable rows={ROWS} selectedRowIds={new Set()} onToggle={vi.fn()} />);

    const duplicateCheckbox = screen.getByRole("checkbox", { name: /MSFT/ });
    const errorCheckbox = screen.getByRole("checkbox", { name: /TSLA/ });

    expect(duplicateCheckbox).toBeDisabled();
    expect(duplicateCheckbox).toHaveAttribute("title", "Ya existe");
    expect(errorCheckbox).toBeDisabled();
    expect(errorCheckbox).toHaveAttribute("title", "Precio inválido");
  });

  it("calls onToggle when a NEW row checkbox is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<PreviewTable rows={ROWS} selectedRowIds={new Set()} onToggle={onToggle} />);

    await user.click(screen.getByRole("checkbox", { name: /AAPL/ }));

    expect(onToggle).toHaveBeenCalledWith("r1");
  });
});
