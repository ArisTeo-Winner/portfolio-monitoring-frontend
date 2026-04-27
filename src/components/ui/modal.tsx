"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  onClose?: () => void;
  overlayClassName?: string;
  panelClassName?: string;
  hideDefaultCloseButton?: boolean;
};

export function Modal({ children, onClose, overlayClassName, panelClassName, hideDefaultCloseButton = false }: Props) {
  return (
    <div
      className={`fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/28 px-2.5 py-2.5 backdrop-blur-md md:px-3 md:py-4 ${overlayClassName ?? ""}`}
    >
      <div
        className={`relative my-auto max-h-[calc(100vh-1rem)] w-full max-w-[404px] overflow-y-auto rounded-[1.25rem] bg-white/98 p-3.5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] md:p-4 ${panelClassName ?? ""}`}
      >
        {onClose && !hideDefaultCloseButton ? (
          <button
            aria-label="Close"
            className="absolute right-2.5 top-2.5 rounded-full p-1.5 text-[1.35rem] leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 md:right-3 md:top-3"
            onClick={onClose}
            suppressHydrationWarning
            type="button"
          >
            &times;
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}
