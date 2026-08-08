// ASSUMPTION (backend contract not finalized as of 2026-08-07): field names
// below follow the existing transaction.types.ts convention (assetSymbol/
// assetType/pricePerUnit) since preview rows are expected to map onto the
// same transaction domain once confirmed. Single edit point if the real
// backend contract differs.
//
// Special-case signaling is by HTTP status: 501 Not Implemented on
// /import/preview means the docType isn't supported yet (e.g. currently
// GBM_MONTHLY_STATEMENT); 422 Unprocessable Entity with
// errorCode === SCANNED_PDF_ERROR_CODE means the uploaded PDF has no
// extractable text layer.

export type GbmDocType = "GBM_MONTHLY_STATEMENT" | "DRIVEWEALTH_CONFIRMATION";

export type ImportRowStatus = "NEW" | "DUPLICATE" | "ERROR";

export type ImportPreviewRow = {
  rowId: string;
  assetSymbol: string;
  assetType: string;
  quantity: number;
  pricePerUnit: number;
  transactionDate: string;
  status: ImportRowStatus;
  statusReason?: string;
};

export type ImportPreviewResponse = {
  previewId: string;
  docType: GbmDocType;
  rows: ImportPreviewRow[];
};

export type ImportConfirmRequest = {
  previewId: string;
  rowIds: string[];
};

export type ImportConfirmResponse = {
  importedCount: number;
};

export const SCANNED_PDF_ERROR_CODE = "SCANNED_PDF";
