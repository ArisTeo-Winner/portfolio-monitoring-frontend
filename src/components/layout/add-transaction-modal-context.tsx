"use client";

import { createContext, useContext } from "react";
import type { AssetOption } from "@/features/assets/types/asset.types";

export type OpenAddTransactionModalOptions = {
  portfolioAssetType?: string;
  portfolioName?: string;
  suggestedAssets?: AssetOption[];
  requireAssetTypeSelection?: boolean;
};

type AddTransactionModalContextValue = {
  openAddTransactionModal: (options?: OpenAddTransactionModalOptions) => void;
};

// Single shared "Add Transaction" modal instance lives in ProtectedShell —
// pages must open it through this context instead of rendering their own
// AddTransactionModal, otherwise two independent instances can end up open
// at once (stale state in one, fresh state in the other).
const AddTransactionModalContext = createContext<AddTransactionModalContextValue | null>(null);

export const AddTransactionModalProvider = AddTransactionModalContext.Provider;

export function useAddTransactionModal() {
  const context = useContext(AddTransactionModalContext);
  if (!context) {
    throw new Error("useAddTransactionModal must be used within ProtectedShell");
  }
  return context;
}
