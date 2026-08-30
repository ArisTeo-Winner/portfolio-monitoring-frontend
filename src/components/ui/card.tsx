"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "article" | "div" | "section";
};

export function Card({ as: Element = "section", className, ...props }: CardProps) {
  return (
    <Element
      className={cn(
        "rounded-2xl border border-neutral-800 bg-neutral-900 p-6 transition duration-150 ease-out hover:border-neutral-700",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-6 flex items-start justify-between gap-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-base font-semibold text-neutral-50", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-sm text-neutral-400", className)} {...props} />;
}
