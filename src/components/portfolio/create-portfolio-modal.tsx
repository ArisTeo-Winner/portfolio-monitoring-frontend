"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ProblemAlert } from "@/components/ui/problem-alert";
import { PORTFOLIO_DEFINITIONS } from "@/components/portfolio/portfolio-sidebar";
import { savePortfolioPreference } from "@/features/portfolio/lib/local-portfolios";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  existingAssetTypes: string[];
};

export function CreatePortfolioModal({ isOpen, onClose, onCreated, existingAssetTypes }: Props) {
  const availableTypes = useMemo(
    () => PORTFOLIO_DEFINITIONS.filter((item) => !existingAssetTypes.includes(item.assetType)),
    [existingAssetTypes],
  );

  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState<string>(availableTypes[0]?.assetType ?? "CRYPTO");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleClose() {
    setName("");
    setError(null);
    setAssetType(availableTypes[0]?.assetType ?? "CRYPTO");
    onClose();
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Portfolio name is required.");
      return;
    }
    if (!assetType) {
      setError("Choose an asset class.");
      return;
    }

    savePortfolioPreference({
      assetType,
      label: trimmed,
      createdAt: new Date().toISOString(),
    });
    handleClose();
    onCreated();
  }

  return (
    <Modal onClose={handleClose} panelClassName="max-w-[340px] px-3 py-3 md:max-w-[360px] md:px-4 md:py-4">
      <div className="space-y-4">
        <header className="space-y-1.5">
          <p className="text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-[var(--brand)]">Portfolio setup</p>
          <h2 className="text-[1.02rem] font-bold tracking-[-0.03em] text-slate-950">Create Portfolio</h2>
        </header>

        <label className="block rounded-[0.92rem] bg-[#eef2f6] px-3 py-2.5">
          <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Name</span>
          <input
            className="mt-2 w-full bg-transparent text-[0.9rem] font-semibold text-slate-950 outline-none placeholder:text-slate-400"
            onChange={(event) => setName(event.target.value)}
            placeholder="Crypto"
            type="text"
            value={name}
          />
        </label>

        <label className="block rounded-[0.92rem] bg-[#eef2f6] px-3 py-2.5">
          <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-400">Asset class</span>
          <select
            className="mt-2 w-full bg-transparent text-[0.9rem] font-semibold text-slate-950 outline-none"
            onChange={(event) => setAssetType(event.target.value)}
            value={assetType}
          >
            {availableTypes.map((item) => (
              <option key={item.assetType} value={item.assetType}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {!availableTypes.length ? <ProblemAlert message="All available asset classes already have a portfolio." /> : null}
        <ProblemAlert message={error} />

        <button
          className="w-full rounded-[0.9rem] bg-[var(--brand)] px-4 py-2.25 text-[0.8rem] font-semibold text-white shadow-[0_12px_24px_rgba(67,97,238,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!availableTypes.length}
          onClick={handleSubmit}
          type="button"
        >
          Create portfolio
        </button>
      </div>
    </Modal>
  );
}
