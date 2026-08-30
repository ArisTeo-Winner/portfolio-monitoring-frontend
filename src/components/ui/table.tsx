"use client";

import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />;
}

export function TableContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-900", className)}
      {...props}
    />
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-neutral-800 text-xs uppercase tracking-wide text-neutral-400", className)} {...props} />;
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-neutral-800", className)} {...props} />;
}

export function TR({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition duration-150 ease-out hover:bg-neutral-800/50", className)} {...props} />;
}

export function TH({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("px-4 py-3 font-medium", className)} {...props} />;
}

export function TD({ className, numeric = false, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td className={cn("px-4 py-3 text-neutral-200", numeric && "text-right tabular-nums", className)} {...props} />;
}
