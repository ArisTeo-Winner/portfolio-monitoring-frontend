export type TransactionMode = "BUY" | "SELL" | "TRANSFER" | "DIVIDEND";
export type TransferDirection = "TRANSFER_IN" | "TRANSFER_OUT";
export type DividendType = "CASH" | "STOCK";

export type BuyOrSellTransactionPayload = {
  assetSymbol: string;
  assetType: string;
  quantity: number;
  pricePerUnit: number;
  fee?: number;
  transactionDate: string;
  notes?: string;
  broker?: string;
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
};

export type TransferTransactionPayload = {
  assetSymbol: string;
  assetType: string;
  transferType: TransferDirection;
  quantity: number;
  fee?: number;
  transactionDate: string;
  notes?: string;
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
};

export type TransactionResponse = {
  transactionId: string;
  assetSymbol: string;
  assetType: string;
  transactionType: string;
  quantity: number;
  pricePerUnit: number;
  totalValue: number;
  transactionDate: string;
  fee: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  // Present on broker-linked transactions (both imported and manual). The
  // backend returns these on the list response; used to attribute an imported
  // transaction back to the channel that created it. See the import-review flow.
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

