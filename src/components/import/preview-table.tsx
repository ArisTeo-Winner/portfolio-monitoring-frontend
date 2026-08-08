"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatCurrency, formatQuantity } from "@/lib/utils/format";
import type { ImportPreviewRow, ImportRowStatus } from "@/features/import/types/import.types";

const STATUS_LABEL: Record<ImportRowStatus, string> = {
  NEW: "Nueva",
  DUPLICATE: "Duplicada",
  ERROR: "Error",
};

const STATUS_TONE: Record<ImportRowStatus, "success" | "default" | "danger"> = {
  NEW: "success",
  DUPLICATE: "default",
  ERROR: "danger",
};

type Props = {
  rows: ImportPreviewRow[];
  selectedRowIds: Set<string>;
  onToggle: (rowId: string) => void;
};

export function PreviewTable({ rows, selectedRowIds, onToggle }: Props) {
  return (
    <TableContainer data-testid="import-preview-table">
      <Table>
        <THead>
          <TR>
            <TH aria-label="Seleccionar" />
            <TH>Símbolo</TH>
            <TH>Tipo</TH>
            <TH>Cantidad</TH>
            <TH>Precio</TH>
            <TH>Fecha</TH>
            <TH>Estado</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => {
            const selectable = row.status === "NEW";

            return (
              <TR data-testid="import-preview-row" key={row.rowId}>
                <TD>
                  <input
                    aria-label={`Seleccionar ${row.assetSymbol}`}
                    checked={selectedRowIds.has(row.rowId)}
                    data-testid="import-row-checkbox"
                    disabled={!selectable}
                    onChange={() => onToggle(row.rowId)}
                    title={!selectable ? row.statusReason : undefined}
                    type="checkbox"
                  />
                </TD>
                <TD>{row.assetSymbol}</TD>
                <TD>{row.assetType}</TD>
                <TD numeric>{formatQuantity(row.quantity)}</TD>
                <TD numeric>{formatCurrency(row.pricePerUnit)}</TD>
                <TD>{row.transactionDate}</TD>
                <TD>
                  <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </TableContainer>
  );
}
