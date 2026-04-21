"use client";

type Props = {
  message?: string | null;
  className?: string;
};

export function ProblemAlert({ message, className }: Props) {
  if (!message) {
    return null;
  }

  return (
    <div className={className ?? "rounded-2xl bg-red-50/95 px-4 py-3 text-sm text-red-700 shadow-[0_12px_28px_rgba(239,68,68,0.12)]"}>
      {message}
    </div>
  );
}
