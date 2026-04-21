"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline";
  block?: boolean;
  icon?: ReactNode;
};

export function Button({ className, variant = "primary", block = false, icon, children, ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
        block && "w-full",
        variant === "primary" && "bg-[var(--brand)] text-white shadow-[0_14px_30px_rgba(53,89,232,0.28)] hover:bg-[#294ce0]",
        variant === "secondary" && "bg-white text-slate-800 shadow-[0_8px_20px_rgba(15,23,42,0.08)] hover:bg-slate-50",
        variant === "outline" && "bg-white/92 text-slate-800 shadow-[0_10px_28px_rgba(15,23,42,0.08)] hover:bg-white",
        className,
      )}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
