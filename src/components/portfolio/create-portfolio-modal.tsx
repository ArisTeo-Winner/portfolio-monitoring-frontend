"use client";

import { useMemo, useState } from "react";
import { ProblemAlert } from "@/components/ui/problem-alert";
import { PORTFOLIO_DEFINITIONS } from "@/components/portfolio/portfolio-sidebar-data";
import { usePortfolioStore } from "@/state/portfolio.store";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "method" | "manual" | "wallet" | "binance";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  existingAssetTypes: string[];
};

// ─── Option card data ─────────────────────────────────────────────────────────

const METHODS = [
  {
    id: "manual" as const,
    icon: <ManualIcon />,
    title: "Add Transactions Manually",
    description: "Enter all transaction details at your own pace to track your portfolio.",
    available: true,
  },
  {
    id: "wallet" as const,
    icon: <WalletIcon />,
    title: "Connect Your Wallet",
    description: (
      <>
        Simply enter your wallet address{" "}
        <strong className="text-white">(no signature needed!)</strong> and we&apos;ll sync it right away.
      </>
    ),
    available: false,
  },
  {
    id: "binance" as const,
    icon: <BinanceIcon />,
    title: "Connect Binance Account",
    description: (
      <>
        Securely sync assets from your Binance account{" "}
        <strong className="text-white">without using API key</strong>.
      </>
    ),
    available: false,
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function CreatePortfolioModal({ isOpen, onClose, onCreated, existingAssetTypes }: Props) {
  const addPortfolio = usePortfolioStore((s) => s.addPortfolio);

  const availableTypes = useMemo(
    () => PORTFOLIO_DEFINITIONS.filter((item) => !existingAssetTypes.includes(item.assetType)),
    [existingAssetTypes],
  );

  const [step, setStep] = useState<Step>("method");
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState<string>(availableTypes[0]?.assetType ?? "CRYPTO");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleClose() {
    setStep("method");
    setName("");
    setError(null);
    setAssetType(availableTypes[0]?.assetType ?? "CRYPTO");
    onClose();
  }

  function handleMethodSelect(id: Step) {
    setStep(id);
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Portfolio name is required."); return; }
    if (!assetType) { setError("Choose an asset class."); return; }

    addPortfolio({ assetType, label: trimmed, createdAt: new Date().toISOString() });
    handleClose();
    onCreated();
  }

  return (
    // Overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#070a11]/80 backdrop-blur-[6px]" />

      {/* Panel */}
      <div className="relative w-full max-w-[480px] overflow-hidden rounded-[1.4rem] border border-[#1f2430] bg-[#111317] shadow-[0_40px_100px_rgba(0,0,0,0.56)]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-[#1a1f29] px-6 py-5">
          <div className="flex items-center gap-3">
            {step !== "method" ? (
              <button
                aria-label="Back"
                className="mr-1 flex h-8 w-8 items-center justify-center rounded-full text-[#8a94a6] transition hover:bg-[#1b2130] hover:text-white"
                onClick={() => setStep("method")}
                type="button"
              >
                <BackArrowIcon />
              </button>
            ) : null}
            <h2 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-white">
              {step === "method" ? "Create portfolio" : step === "manual" ? "Add portfolio" : step === "wallet" ? "Connect Wallet" : "Connect Binance"}
            </h2>
          </div>
          <button
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#8a94a6] transition hover:bg-[#1b2130] hover:text-white"
            onClick={handleClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-5 py-5">

          {/* Step: method selection */}
          {step === "method" ? (
            <div className="space-y-3">
              {METHODS.map((method) => (
                <button
                  className={`group w-full rounded-[1.05rem] border p-4 text-left transition-all duration-200 ${
                    method.available
                      ? "border-[#1f2430] bg-[#0d1014] hover:border-[#2a3245] hover:bg-[#13171f] hover:shadow-[0_12px_32px_rgba(0,0,0,0.3)]"
                      : "cursor-default border-[#181d26] bg-[#0b0e13] opacity-60"
                  }`}
                  disabled={!method.available}
                  key={method.id}
                  onClick={() => method.available && handleMethodSelect(method.id)}
                  type="button"
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.9rem] bg-[#161b23] shadow-[0_8px_20px_rgba(0,0,0,0.24)]">
                      {method.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[0.92rem] font-semibold text-white">{method.title}</p>
                        {!method.available ? (
                          <span className="shrink-0 rounded-full bg-[#1e2535] px-2.5 py-0.5 text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-[#7f8aa3]">
                            Próximamente
                          </span>
                        ) : (
                          <ChevronIcon className="shrink-0 text-[#7f8aa3] transition group-hover:translate-x-0.5 group-hover:text-white" />
                        )}
                      </div>
                      <p className="mt-1.5 text-[0.8rem] leading-[1.5] text-[#7f8aa3]">{method.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {/* Step: manual form */}
          {step === "manual" ? (
            <div className="space-y-4">
              {!availableTypes.length ? (
                <ProblemAlert message="All available asset classes already have a portfolio." />
              ) : null}

              <div className="space-y-3">
                <label className="block rounded-[0.95rem] border border-[#1f2430] bg-[#0d1014] px-4 py-3 transition focus-within:border-[#2a3245]">
                  <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[#71819b]">Name</span>
                  <input
                    autoFocus
                    className="mt-2 w-full bg-transparent text-[0.92rem] font-semibold text-white outline-none placeholder:text-[#3d4755]"
                    onChange={(e) => { setName(e.target.value); setError(null); }}
                    placeholder="Crypto"
                    type="text"
                    value={name}
                  />
                </label>

                <label className="block rounded-[0.95rem] border border-[#1f2430] bg-[#0d1014] px-4 py-3 transition focus-within:border-[#2a3245]">
                  <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-[#71819b]">Asset class</span>
                  <select
                    className="mt-2 w-full bg-transparent text-[0.92rem] font-semibold text-white outline-none"
                    onChange={(e) => setAssetType(e.target.value)}
                    value={assetType}
                  >
                    {availableTypes.map((item) => (
                      <option className="bg-[#111317]" key={item.assetType} value={item.assetType}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <ProblemAlert message={error} />

              <button
                className="w-full rounded-[0.9rem] bg-[#17c784] px-4 py-3 text-[0.88rem] font-semibold text-[#0a1a12] shadow-[0_12px_28px_rgba(23,199,132,0.22)] transition hover:bg-[#1ad48f] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!availableTypes.length}
                onClick={handleSubmit}
                type="button"
              >
                Create portfolio
              </button>
            </div>
          ) : null}

          {/* Step: wallet (coming soon) */}
          {step === "wallet" ? (
            <ComingSoonPlaceholder
              description="La conexión de wallets estará disponible en una próxima versión."
              icon={<WalletIcon large />}
              title="Connect Your Wallet"
            />
          ) : null}

          {/* Step: binance (coming soon) */}
          {step === "binance" ? (
            <ComingSoonPlaceholder
              description="La integración con Binance estará disponible en una próxima versión."
              icon={<BinanceIcon large />}
              title="Connect Binance"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ComingSoonPlaceholder({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-[1.2rem] bg-[#0d1014] shadow-[0_16px_36px_rgba(0,0,0,0.28)]">
        {icon}
      </div>
      <p className="mt-5 text-[1rem] font-semibold text-white">{title}</p>
      <p className="mt-2 max-w-[26rem] text-[0.82rem] leading-[1.6] text-[#7f8aa3]">{description}</p>
      <span className="mt-4 rounded-full bg-[#1e2535] px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#7f8aa3]">
        Próximamente
      </span>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ManualIcon({ large }: { large?: boolean }) {
  const s = large ? "h-8 w-8" : "h-5 w-5";
  return (
    <svg className={`${s} text-[#17c784]`} fill="none" viewBox="0 0 24 24">
      <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function WalletIcon({ large }: { large?: boolean }) {
  const s = large ? "h-8 w-8" : "h-5 w-5";
  return (
    <svg className={`${s} text-[#3b82f6]`} fill="none" viewBox="0 0 24 24">
      <path d="M3 10h18M3 6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <circle cx="17" cy="15" fill="currentColor" r="1" />
    </svg>
  );
}

function BinanceIcon({ large }: { large?: boolean }) {
  const s = large ? "h-8 w-8" : "h-5 w-5";
  return (
    <svg className={`${s} text-[#f0b90b]`} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l2.4 2.4-7.6 7.6-2.4-2.4L12 2zM4.8 9.6l2.4 2.4-2.4 2.4-2.4-2.4 2.4-2.4zm14.4 0l2.4 2.4-2.4 2.4-2.4-2.4 2.4-2.4zm-7.2 2.4l2.4 2.4-7.6 7.6-2.4-2.4 7.6-7.6zm2.4 2.4l2.4-2.4 2.4 2.4-2.4 2.4-2.4-2.4z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function BackArrowIcon() {
  return (
    <svg fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}
