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
      panelClassName="max-w-[500px] rounded-[1.65rem] border border-[#262a31] bg-[#16181d] p-6 shadow-[0_32px_95px_rgba(0,0,0,0.56)] md:p-7"
    >
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-[2.1rem] font-bold tracking-[-0.05em] text-white">
              {mode === "login" ? "Bienvenido" : "Crea tu cuenta"}
            </h2>
            <p className="text-[1.03rem] text-[#9097a3]">
              {mode === "login" ? "Accede a tu portfolio." : "Empieza a rastrear tu patrimonio."}
            </p>
          </div>
          <button
            aria-label="Cerrar"
            className="inline-flex h-10 w-10 items-center justify-center rounded-[0.95rem] bg-[#20232a] text-[#8f98a7] transition hover:bg-[#252932] hover:text-white"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <GoogleAuthButton
            className="h-[3.25rem] rounded-[1rem] border border-[#2a2f37] bg-[#0f1116] py-3 font-semibold text-white shadow-none hover:bg-[#131720]"
            label="Google"
          />
          <button
            className="inline-flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-[1rem] border border-[#2a2f37] bg-[#0f1116] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#131720]"
            type="button"
          >
            <AppleIcon />
            <span>Apple</span>
          </button>
        </div>

        <ProblemAlert
          className="rounded-[1rem] border border-[#4b1d28] bg-[#241217] px-4 py-3 text-sm text-[#ff8ea5] shadow-none"
          message={oauthErrorMessage}
        />

        {mode === "register" ? (
          <RegisterForm onRegistered={(email) => onRegistered?.(email)} />
        ) : (
          <LoginForm initialEmail={prefilledEmail} />
        )}

        <div className="pt-1 text-center text-sm text-[#727a86]">
          {mode === "login" ? (
            <>
              No tienes cuenta?{" "}
              <button className="font-semibold text-[#19c37d] transition hover:text-[#29d28d]" onClick={() => onModeChange("register")} type="button">
                Registrate
              </button>
            </>
          ) : (
            <>
              Ya tienes cuenta?{" "}
              <button className="font-semibold text-[#19c37d] transition hover:text-[#29d28d]" onClick={() => onModeChange("login")} type="button">
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

function AppleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path
        d="M15.3 3.7c-.9.1-1.9.7-2.5 1.5-.5.7-.9 1.7-.8 2.7 1 .1 1.9-.5 2.5-1.2.6-.8 1-1.8.8-3ZM18.6 12.6c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.7-1.7-3.3-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8-1.6 0-3 .9-3.8 2.2-1.6 2.7-.4 6.7 1.1 8.9.7 1.1 1.6 2.3 2.8 2.2 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-1.1 2.8-2.2.8-1.2 1.2-2.4 1.2-2.5-.1 0-2.1-.8-2.1-3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
