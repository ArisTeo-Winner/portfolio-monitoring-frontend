import type { PresentationEnvelope } from "@/features/portfolio/types/presentation.types";

export type PortfolioHistoryPoint = {
  time: number;
  value: number;
};

export type PortfolioHistoryMeta = {
  range: string;
  resolution: string;
  from: number;
  to: number;
  // ADR-0010: equals displayCurrency (was hardcoded "USD" before). Legacy
  // vnd.portfolio.v1+json responses stay "USD".
  currency: string;
  points: number;
  // ADR-0010: presentation envelope; absent on pre-ADR-0010 backends.
  presentation?: PresentationEnvelope;
  // Presentes cuando algún activo no se pudo cotizar en ningún proveedor: la serie es parcial.
  partial?: boolean;
  unavailableSymbols?: string[];
};

export type PortfolioHistoryResponse = {
  meta: PortfolioHistoryMeta;
  series: PortfolioHistoryPoint[];
};
