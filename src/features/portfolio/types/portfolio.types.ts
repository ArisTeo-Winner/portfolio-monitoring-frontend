import type { PresentationEnvelope } from "@/features/portfolio/types/presentation.types";

export type PortfolioEntry = {
  portfolioEntryId: string;
  userId: string;
  assetSymbol: string;
  assetType: string;
  totalQuantity: string;
  totalInvested: string;
  averagePricePerUnit: string;
  lastTransactionPrice: string;
  currentValue: string;
  totalProfitLoss: string;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
  // ADR-0010: present when the backend applied a presentation currency. Redundant
  // across entries (same value); read from any. Absent on pre-ADR-0010 backends.
  presentation?: PresentationEnvelope;
};
