export type TransactionMode = "BUY" | "SELL" | "TRANSFER";
export type TransferDirection = "TRANSFER_IN" | "TRANSFER_OUT";

export type BuyOrSellTransactionPayload = {
  assetSymbol: string;
  assetType: string;
  quantity: number;
  pricePerUnit: number;
  fee?: number;
  transactionDate: string;
  notes?: string;
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
};

