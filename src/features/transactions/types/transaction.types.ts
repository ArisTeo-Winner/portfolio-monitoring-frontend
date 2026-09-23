export type TransactionMode = "BUY" | "SELL" | "TRANSFER" | "DIVIDEND";
export type TransferDirection = "TRANSFER_IN" | "TRANSFER_OUT";
export type DividendType = "CASH" | "STOCK";
// Settlement currency of the operation. The backend persists this verbatim
// (it is a first-class column, never inferred), so the frontend MUST send it —
// otherwise a MXN (BMV/GBM) trade is stored with no currency and later valued
// as if it were USD. Native amounts are stored as-entered; FX conversion happens
// at valuation, never at write.
export type TransactionCurrency = "MXN" | "USD";

export type BuyOrSellTransactionPayload = {
  assetSymbol: string;
  assetType: string;
  quantity: number;
  pricePerUnit: number;
  // Single-fee path (classic). Send this OR the split fields below, never both:
  // if any split field is present the backend derives fee = commission+iva+other
  // and ignores `fee` (ADR-0005).
  fee?: number;
  // Manual commission/IVA split (BUY/SELL). All optional, each ≥ 0. When any is
  // sent the backend derives `fee` from their sum and populates the fine-grained
  // FrictionBreakdown. IVA is an ABSOLUTE amount (the UI computes 16% for MXN),
  // not a rate — the backend never recomputes it.
  brokerCommission?: number;
  brokerIva?: number;
  otherFees?: number;
  transactionDate: string;
  notes?: string;
  broker?: string;
  currency?: TransactionCurrency;
  // GOVERNMENT_BOND-only fields, only sent on BUY when assetType is a bond.
  faceValue?: number;
  maturityDate?: string;
  couponRate?: number;
  autoReinvestment?: boolean;
};

export type RegisterDividendPayload = {
  assetSymbol: string;
  assetType: string;
  amount: number;
  dividendType: DividendType;
  transactionDate: string;
  exDividendDate?: string;
  taxWithheld?: number;
  broker?: string;
  currency?: TransactionCurrency;
};

export type TransferTransactionPayload = {
  assetSymbol: string;
  assetType: string;
  transferType: TransferDirection;
  quantity: number;
  fee?: number;
  transactionDate: string;
  notes?: string;
  currency?: TransactionCurrency;
};

export type UpdateTransactionPayload = {
  assetSymbol: string;
  assetType: string;
  quantity: number;
  pricePerUnit?: number;
  transactionDate: string;
  fee?: number;
  notes?: string;
  transferType?: TransferDirection;
  currency?: TransactionCurrency;
};

export type TransactionResponse = {
  transactionId: string;
  assetSymbol: string;
  assetType: string;
  assetName?: string | null;
  logoUrl?: string | null;
  transactionType: string;
  quantity: number;
  pricePerUnit: number;
  totalValue: number;
  transactionDate: string;
  fee: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  broker?: string | null;
  currency?: string | null;
};

export type FrictionReviewStatus = "OK" | "REQUIERE_REVISION";

/**
 * Backend-computed brokerage friction audit for a single transaction.
 *
 * Every value here is calculated server-side; the UI only renders them and
 * never performs arithmetic on money, so there is no float precision loss to
 * worry about (see the money-handling note in the brief). We keep the numeric
 * shape the backend sends rather than coercing to string, to stay consistent
 * with the rest of TransactionDetailsResponse.
 *
 * The four "fine-grained" fields (brokerCommission, brokerIva, otherFees,
 * reviewStatus) are null on manual entries — they are only meaningful for
 * broker-imported transactions. Render them ONLY when brokerCommission != null.
 * The derived fields (grossAmount / totalFrictionCost / finalNetCost /
 * adjustedUnitPrice) are always present (adjustedUnitPrice is null only when
 * quantity is 0).
 */
export type FrictionBreakdown = {
  grossAmount: number;
  brokerCommission: number | null;
  brokerIva: number | null;
  otherFees: number | null;
  totalFrictionCost: number;
  finalNetCost: number;
  adjustedUnitPrice: number | null;
  /**
   * Friction per unit = totalFrictionCost / quantity (backend-computed, scale 8).
   * Backend guarantees perUnitFriction === adjustedUnitPrice − pricePerUnit, so
   * the UI can render the ejecución→equilibrio "bridge" without doing money math
   * (ADR-0001). Optional: absent on responses predating the backend field.
   */
  perUnitFriction?: number | null;
  reviewStatus: FrictionReviewStatus | null;
};

export type TransactionDetailsResponse = {
  id: string;
  assetSymbol: string;
  assetType: string;
  transactionType: string;
  transferType?: string | null;
  transactionDate: string;
  quantity: number;
  pricePerUnit: number;
  grossAmount: number;
  fee: number;
  feeCurrency: string;
  netAmount?: number | null;
  amountLabel?: string | null;
  notes?: string | null;
  source?: string | null;
  exchange?: string | null;
  status?: string | null;
  frictionBreakdown?: FrictionBreakdown | null;
};

