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
  "data-testid"?: string;
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
  "data-testid": dataTestId,
  ...props
}: Props) {
  return (
    <label className="block space-y-2">
      {!hideLabel ? (
        <div className="flex items-center justify-between">
          <span className={cn("text-sm font-semibold text-slate-800", labelClassName)}>{label}</span>
          {action}
        </div>
      ) : (
        <span className="sr-only">{label}</span>
      )}
      <div
        data-testid={dataTestId}
        className={cn(
          "flex min-h-[44px] items-center rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2.5 transition duration-150 ease-out",
          error ? "border-red-500/60" : "focus-within:border-blue-500",
          wrapperClassName,
        )}
      >
        {icon ? <span className="mr-3 shrink-0 text-neutral-400">{icon}</span> : null}
        <input
          className={cn(
            "w-full bg-transparent text-sm text-neutral-50 outline-none placeholder:text-neutral-500",
            inputClassName,
            className,
          )}
          suppressHydrationWarning
          {...props}
        />
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </label>
  );
}
