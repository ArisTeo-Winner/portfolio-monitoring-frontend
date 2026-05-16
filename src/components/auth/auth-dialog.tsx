"use client";

import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { Modal } from "@/components/ui/modal";
import { ProblemAlert } from "@/components/ui/problem-alert";

type Mode = "login" | "register";

type Props = {
  mode: Mode;
  open: boolean;
  onClose: () => void;
  onModeChange: (mode: Mode) => void;
  prefilledEmail?: string;
  onRegistered?: (email: string) => void;
  oauthErrorMessage?: string | null;
};

export function AuthDialog({
  mode,
  open,
  onClose,
  onModeChange,
  prefilledEmail = "",
  onRegistered,
  oauthErrorMessage = null,
}: Props) {
  if (!open) {
    return null;
  }

  return (
    <Modal
      hideDefaultCloseButton
      onClose={onClose}
      overlayClassName="bg-black/78 backdrop-blur-md"
      panelClassName="max-h-[92vh] max-w-[500px] overflow-y-auto rounded-2xl border border-[#262a31] bg-[#15181d] p-4 shadow-[0_20px_70px_rgba(0,0,0,0.45)] md:rounded-[1.65rem] md:p-7 md:shadow-[0_32px_95px_rgba(0,0,0,0.56)]"
    >
      <div className="space-y-3 md:space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5 md:space-y-1">
            <h2 className="text-[1.45rem] font-bold tracking-[-0.04em] text-white md:text-[2.1rem] md:tracking-[-0.05em]">
              {mode === "login" ? "Bienvenido" : "Crea tu cuenta"}
            </h2>
            <p className="text-[0.875rem] text-[#9097a3] md:text-[1.03rem]">
              {mode === "login" ? "Accede a tu portfolio." : "Empieza a rastrear tu patrimonio."}
            </p>
          </div>
          <button
            aria-label="Cerrar"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#20232a] text-[#8f98a7] transition hover:bg-[#252932] hover:text-white md:h-10 md:w-10 md:rounded-[0.95rem]"
            onClick={onClose}
            suppressHydrationWarning
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <GoogleAuthButton
            className="h-12 rounded-xl border border-[#2a2f37] bg-[#0f1116] py-0 text-[0.875rem] font-semibold text-white shadow-none hover:bg-[#131720] md:h-[3.25rem] md:rounded-[1rem] md:py-3 md:text-base"
            label="Google"
          />
        </div>

        <ProblemAlert
          className="rounded-xl border border-[#4b1d28] bg-[#241217] px-3 py-2 text-[0.8125rem] text-[#ff8ea5] shadow-none md:rounded-[1rem] md:px-4 md:py-3 md:text-sm"
          message={oauthErrorMessage}
        />

        {mode === "register" ? (
          <RegisterForm onRegistered={(email) => onRegistered?.(email)} />
        ) : (
          <LoginForm initialEmail={prefilledEmail} />
        )}

        <div className="pt-1 text-center text-[0.8125rem] text-[#8d98a8] md:text-sm">
          {mode === "login" ? (
            <>
              No tienes cuenta?{" "}
              <button className="font-semibold text-[#19c37d] transition hover:text-[#29d28d]" onClick={() => onModeChange("register")} suppressHydrationWarning type="button">
                Registrate
              </button>
            </>
          ) : (
            <>
              Ya tienes cuenta?{" "}
              <button className="font-semibold text-[#19c37d] transition hover:text-[#29d28d]" onClick={() => onModeChange("login")} suppressHydrationWarning type="button">
                Inicia sesion
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path
        d="M6 6L18 18M18 6L6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}
