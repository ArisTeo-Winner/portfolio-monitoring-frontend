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
    <div className={className ?? "rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"}>
      {message}
    </div>
  );
}
