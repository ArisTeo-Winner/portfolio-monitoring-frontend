"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ProblemAlert } from "@/components/ui/problem-alert";
import { GbmUploadSection } from "@/components/import/gbm-upload-section";
import { invalidatePortfolioCache } from "@/features/portfolio/api/get-portfolio";
import { usePortfolioStore } from "@/state/portfolio.store";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_NAME_LENGTH = 24;

const AVATAR_OPTIONS = ["💰", "📈", "🪙", "🏦", "💎", "🚀", "⚡", "🌐", "🔥", "🛡️"] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "method" | "manual" | "avatar" | "wallet" | "binance" | "okx" | "gbm";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  existingAssetTypes: string[];
  /** When provided, opens in Edit mode pre-filled with these values. */
  editingPortfolio?: { assetType: string; label: string; avatar?: string; countAsTotal?: boolean; createdAt?: string };
};

// ─── Method cards ─────────────────────────────────────────────────────────────

const METHODS = [
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
    id: "manual" as const,
    icon: <ManualIcon />,
    title: "Add Transactions Manually",
    description: "Enter all transaction details at your own pace to track your portfolio.",
    available: false,
  },
  {
    id: "gbm" as const,
    icon: <GbmIcon />,
    title: "Importar desde GBM",
    description: (
      <>
        Sube tu estado de cuenta mensual o tus confirmaciones DriveWealth{" "}
        <strong className="text-white">en PDF</strong> y las transacciones se importan automáticamente.
      </>
    ),
    available: true,
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
  {
    id: "okx" as const,
    icon: <OkxIcon />,
    title: "Connect OKX Account",
    description: (
      <>
        Securely sync assets from your OKX account{" "}
        <strong className="text-white">without using API key</strong>.
      </>
    ),
    available: false,
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function CreatePortfolioModal({ isOpen, onClose, onCreated, existingAssetTypes, editingPortfolio }: Props) {
  const addPortfolio = usePortfolioStore((s) => s.addPortfolio);
  const editPortfolio = usePortfolioStore((s) => s.editPortfolio);
  const queryClient = useQueryClient();

  const refreshPortfolioAfterImport = useCallback(async () => {
    invalidatePortfolioCache();
    await queryClient.invalidateQueries({ queryKey: ["portfolio-holdings-performance"] });
    await queryClient.invalidateQueries({ queryKey: ["portfolio-history"] });
  }, [queryClient]);

  const isEditMode = Boolean(editingPortfolio);

  const initialStep: Step = isEditMode ? "manual" : "method";

  const [step, setStep] = useState<Step>(initialStep);
  const [name, setName] = useState(editingPortfolio?.label ?? "");
  const [assetType, setAssetType] = useState<string>(editingPortfolio?.assetType ?? "");
  const [avatar, setAvatar] = useState<string | undefined>(editingPortfolio?.avatar);
  const [countAsTotal, setCountAsTotal] = useState(editingPortfolio?.countAsTotal ?? true);
  const [error, setError] = useState<string | null>(null);

  // Sync form when editingPortfolio changes (modal reused between create/edit)
  useEffect(() => {
    if (isEditMode && editingPortfolio) {
      setStep("manual");
      setName(editingPortfolio.label);
      setAssetType(editingPortfolio.assetType);
      setAvatar(editingPortfolio.avatar);
      setCountAsTotal(editingPortfolio.countAsTotal ?? true);
    } else if (!isEditMode) {
      setStep("method");
      setName("");
      setAvatar(undefined);
      setCountAsTotal(true);
    }
  }, [isEditMode, editingPortfolio]);


  if (!isOpen) return null;

  function handleClose() {
    setStep(initialStep);
    setName("");
    setError(null);
    setAvatar(undefined);
    setCountAsTotal(true);
    setAssetType("");
    onClose();
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Portfolio name is required."); return; }
    if (!assetType) { setError("Choose an asset class."); return; }

    const preference = {
      assetType,
      label: trimmed,
      createdAt: editingPortfolio?.createdAt ?? new Date().toISOString(),
      avatar,
      countAsTotal,
    };

    if (isEditMode) {
      editPortfolio(preference);
    } else {
      addPortfolio(preference);
    }
    handleClose();
    onCreated();
  }

  const stepTitle =
    step === "method" ? "Crear portfolio"
    : isEditMode ? "Editar portfolio"
    : step === "manual" ? "Add portfolio"
    : step === "avatar" ? "Choose avatar"
    : step === "wallet" ? "Connect Wallet"
    : step === "okx" ? "Connect OKX"
    : step === "gbm" ? "Importar desde GBM"
    : "Connect Binance";

  const canGoBack = step !== "method" && !isEditMode;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="absolute inset-0 bg-[#070a11]/80 backdrop-blur-[6px]" />

      <div className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-[480px] flex-col overflow-hidden rounded-[1.4rem] border border-[#1f2430] bg-[#111317] shadow-[0_40px_100px_rgba(0,0,0,0.56)]">

        {/* Header — pinned so the close control stays reachable no matter how tall the body grows */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#1a1f29] px-6 py-5">
          <div className="flex items-center gap-3">
            {canGoBack ? (
              <button
                aria-label="Back"
                className="mr-1 flex h-8 w-8 items-center justify-center rounded-full text-[#8a94a6] transition hover:bg-[#1b2130] hover:text-white"
                onClick={() => setStep(step === "avatar" ? "manual" : "method")}
                type="button"
              >
                <BackArrowIcon />
              </button>
            ) : null}
            <h2 className="text-[1.05rem] font-semibold tracking-[-0.03em] text-white">{stepTitle}</h2>
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

        {/* Body — the only scroll area; keeps the pinned header and viewport height stable */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">

          {/* ── Step: method ── */}
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
                  onClick={() => method.available && setStep(method.id)}
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
              <p className="pt-1 text-center text-[0.8rem] text-[#5f6d82]">
                ¿No ves tu exchange preferido? Escríbenos.
              </p>
            </div>
          ) : null}

          {/* ── Step: manual form (CMC-style) ── */}
          {step === "manual" ? (
            <div className="space-y-5">

              {/* Avatar */}
              <div>
                <p className="mb-3 text-[0.82rem] font-semibold text-[#c4cede]">Portfolio avatar</p>
                <div className="flex items-center gap-4">
                  <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-[#0d1014] text-[2.5rem] shadow-[0_10px_28px_rgba(0,0,0,0.3)]">
                    {avatar ?? (name.trim() ? name.trim().slice(0, 1).toUpperCase() : "?")}
                  </div>
                  <button
                    className="rounded-[0.75rem] bg-[#3861fb] px-4 py-2 text-[0.82rem] font-semibold text-white transition hover:bg-[#4f74ff]"
                    onClick={() => setStep("avatar")}
                    type="button"
                  >
                    Change
                  </button>
                  {avatar ? (
                    <button
                      className="text-[0.78rem] text-[#7f8aa3] transition hover:text-white"
                      onClick={() => setAvatar(undefined)}
                      type="button"
                    >
                      Reset
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Name */}
              <div>
                <p className="mb-2 text-[0.82rem] font-semibold text-[#c4cede]">Portfolio Name</p>
                <div className="rounded-[0.95rem] border border-[#1f2430] bg-[#0d1014] px-4 py-3 transition focus-within:border-[#2a3245]">
                  <input
                    autoFocus
                    className="w-full bg-transparent text-[0.95rem] font-medium text-white outline-none placeholder:text-[#3d4755]"
                    maxLength={MAX_NAME_LENGTH}
                    onChange={(e) => { setName(e.target.value); setError(null); }}
                    placeholder="My portfolio"
                    type="text"
                    value={name}
                  />
                </div>
                <p className="mt-1.5 text-right text-[0.72rem] text-[#5f6d82]">
                  {name.length}/{MAX_NAME_LENGTH} characters
                </p>
              </div>

              {/* Asset class */}
              <div>
                <p className="mb-2 text-[0.82rem] font-semibold text-[#c4cede]">Asset class</p>
                <div className="rounded-[0.95rem] border border-[#1f2430] bg-[#0d1014] px-4 py-3 transition focus-within:border-[#2a3245]">
                  <select
                    className="w-full bg-transparent text-[0.92rem] font-medium text-white outline-none disabled:opacity-60"
                    disabled={isEditMode}
                    onChange={(e) => setAssetType(e.target.value)}
                    value={assetType}
                  >
                    <option className="bg-[#111317]" value={assetType}>{assetType}</option>
                  </select>
                </div>
              </div>

              {/* Count as total toggle */}
              <div className="flex items-start justify-between gap-4 rounded-[0.95rem] border border-[#1a1f29] bg-[#0d1014] px-4 py-4">
                <div>
                  <p className="text-[0.88rem] font-semibold text-white">Count as my portfolio</p>
                  <p className="mt-1 text-[0.76rem] leading-[1.4] text-[#7f8aa3]">
                    Assets in this portfolio will be included in total value
                  </p>
                </div>
                <button
                  aria-checked={countAsTotal}
                  className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                    countAsTotal ? "bg-[#3861fb]" : "bg-[#2a3245]"
                  }`}
                  onClick={() => setCountAsTotal((v) => !v)}
                  role="switch"
                  type="button"
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                      countAsTotal ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              <ProblemAlert message={error} />

              <button
                className="w-full rounded-[0.9rem] bg-[#3861fb] px-4 py-3 text-[0.88rem] font-semibold text-white shadow-[0_12px_28px_rgba(56,97,251,0.22)] transition hover:bg-[#4f74ff] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={false}
                onClick={handleSubmit}
                type="button"
              >
                {isEditMode ? "Guardar cambios" : "Create Portfolio"}
              </button>
            </div>
          ) : null}

          {/* ── Step: avatar picker ── */}
          {step === "avatar" ? (
            <div>
              <p className="mb-4 text-[0.82rem] text-[#7f8aa3]">Select an emoji for your portfolio avatar.</p>
              <div className="grid grid-cols-5 gap-3">
                {AVATAR_OPTIONS.map((emoji) => (
                  <button
                    className={`flex h-14 w-full items-center justify-center rounded-[0.9rem] text-[1.75rem] transition-all duration-150 ${
                      avatar === emoji
                        ? "bg-[#1e2d4a] ring-2 ring-[#3861fb]"
                        : "bg-[#0d1014] hover:bg-[#161b23]"
                    }`}
                    key={emoji}
                    onClick={() => { setAvatar(emoji); setStep("manual"); }}
                    type="button"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* ── Step: wallet / binance placeholders ── */}
          {step === "wallet" ? (
            <ComingSoon description="La conexión de wallets estará disponible en una próxima versión." icon={<WalletIcon large />} title="Connect Your Wallet" />
          ) : null}
          {step === "binance" ? (
            <ComingSoon description="La integración con Binance estará disponible en una próxima versión." icon={<BinanceIcon large />} title="Connect Binance" />
          ) : null}
          {step === "okx" ? (
            <ComingSoon description="La integración con OKX estará disponible en una próxima versión." icon={<OkxIcon large />} title="Connect OKX" />
          ) : null}

          {/* ── Step: GBM import (reuses the same flow as Settings → Conexiones) ── */}
          {step === "gbm" ? (
            <div className="space-y-6">
              <GbmUploadSection onImported={refreshPortfolioAfterImport} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ComingSoon({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-[1.2rem] bg-[#0d1014] shadow-[0_16px_36px_rgba(0,0,0,0.28)]">{icon}</div>
      <p className="mt-5 text-[1rem] font-semibold text-white">{title}</p>
      <p className="mt-2 max-w-[26rem] text-[0.82rem] leading-[1.6] text-[#7f8aa3]">{description}</p>
      <span className="mt-4 rounded-full bg-[#1e2535] px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[#7f8aa3]">Próximamente</span>
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

function OkxIcon({ large }: { large?: boolean }) {
  const s = large ? "h-8 w-8" : "h-5 w-5";
  return (
    <svg className={`${s} text-[#e6e6e6]`} fill="currentColor" viewBox="0 0 24 24">
      <rect height="6" width="6" x="2" y="9" />
      <rect height="6" width="6" x="9" y="2" />
      <rect height="6" width="6" x="9" y="16" />
      <rect height="6" width="6" x="16" y="9" />
    </svg>
  );
}

function GbmIcon({ large }: { large?: boolean }) {
  const s = large ? "h-8 w-8" : "h-5 w-5";
  return (
    <svg className={`${s} text-[#17c784]`} fill="none" viewBox="0 0 24 24">
      <path d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M14 3v4h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="M9 16l2.2 2.2L15 14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
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
