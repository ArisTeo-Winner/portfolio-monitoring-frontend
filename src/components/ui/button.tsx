"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "danger";
  block?: boolean;
  icon?: ReactNode;
};

export function Button({ className, variant = "primary", block = false, icon, children, ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60",
        block && "w-full",
        variant === "primary" && "bg-blue-600 text-white hover:bg-blue-500",
        variant === "secondary" && "border border-neutral-700 bg-neutral-800 text-white hover:bg-neutral-700",
        variant === "outline" && "border border-neutral-700 bg-transparent text-neutral-100 hover:bg-neutral-800",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-500",
        className,
      )}
      suppressHydrationWarning
      {...props}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
