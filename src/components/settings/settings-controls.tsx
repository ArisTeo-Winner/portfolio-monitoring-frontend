"use client";

import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type SelectOption = {
  label: string;
  value: string;
};

type SettingsSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hideLabel?: boolean;
  options: SelectOption[];
};

export function SettingsSelect({ className, error, hideLabel = false, label, options, ...props }: SettingsSelectProps) {
  return (
    <label className="block space-y-2">
      {hideLabel ? null : <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</span>}
      <select
        className={cn(
          "h-12 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 text-sm font-medium text-neutral-100 outline-none transition duration-150 ease-out focus:border-blue-500",
          error && "border-red-500 focus:border-red-500",
          className,
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-red-400">{error}</span> : null}
    </label>
  );
}

type SettingsToggleProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  description?: string;
  label: string;
};

export function SettingsToggle({ checked, className, description, label, ...props }: SettingsToggleProps) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-4">
      <span className="space-y-1">
        <span className="block text-sm font-medium text-neutral-100">{label}</span>
        {description ? <span className="block text-xs text-neutral-400">{description}</span> : null}
      </span>
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 rounded-full border border-neutral-700 bg-neutral-800 transition duration-150 ease-out",
          checked && "border-blue-500 bg-blue-600",
          className,
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition duration-150 ease-out",
            checked && "translate-x-5",
          )}
        />
      </span>
      <input checked={checked} className="sr-only" type="checkbox" {...props} />
    </label>
  );
}
