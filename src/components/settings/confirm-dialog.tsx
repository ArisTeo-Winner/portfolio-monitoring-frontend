"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type ConfirmDialogProps = {
  body: ReactNode;
  confirmLabel: string;
  confirmVariant?: "primary" | "danger";
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending?: boolean;
  title: string;
};

export function ConfirmDialog({
  body,
  confirmLabel,
  confirmVariant = "primary",
  isOpen,
  onClose,
  onConfirm,
  pending = false,
  title,
}: ConfirmDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      onClose={onClose}
      panelClassName="max-w-[360px] rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-neutral-50 shadow-sm"
      overlayClassName="z-[70] bg-neutral-950/70 backdrop-blur-sm"
    >
      <div className="space-y-6">
        <div className="space-y-2 pr-8">
          <h2 className="text-base font-semibold text-neutral-50">{title}</h2>
          <div className="text-sm leading-6 text-neutral-400">{body}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button disabled={pending} onClick={onClose} type="button" variant="secondary">
            Cancelar
          </Button>
          <Button disabled={pending} onClick={onConfirm} type="button" variant={confirmVariant}>
            {pending ? "Procesando" : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
