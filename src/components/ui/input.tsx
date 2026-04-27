"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  action?: ReactNode;
  icon?: ReactNode;
  hideLabel?: boolean;
  labelClassName?: string;
  wrapperClassName?: string;
  inputClassName?: string;
};

export function Input({
  label,
  error,
  className,
  action,
  icon,
  hideLabel = false,
  labelClassName,
  wrapperClassName,
  inputClassName,
  ...props
}: Props) {
  return (
    <label className="block space-y-2">
      {!hideLabel ? (
        <div className="flex items-center justify-between">
          <span className={cn("text-sm font-semibold text-slate-800", labelClassName)}>{label}</span>
          {action}
        </div>
      ) : null}
      <div
        className={cn(
          "flex items-center rounded-2xl bg-white/96 px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.08)]",
          error
            ? "shadow-[0_10px_28px_rgba(239,68,68,0.12)]"
            : "focus-within:shadow-[0_14px_34px_rgba(15,23,42,0.1),0_0_0_6px_rgba(53,89,232,0.06)]",
          wrapperClassName,
        )}
      >
        {icon ? <span className="mr-3 shrink-0 text-slate-400">{icon}</span> : null}
        <input
          className={cn(
            "w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400",
            inputClassName,
            className,
          )}
          suppressHydrationWarning
          {...props}
        />
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </label>
  );
}
