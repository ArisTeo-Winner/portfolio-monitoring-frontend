"use client";

type Props = {
  newCount: number;
  duplicateCount: number;
  errorCount: number;
};

export function ImportSummary({ newCount, duplicateCount, errorCount }: Props) {
  return (
    <p className="text-sm text-neutral-400" data-testid="import-summary">
      {newCount} nueva{newCount === 1 ? "" : "s"}, {duplicateCount} duplicada{duplicateCount === 1 ? "" : "s"}, {errorCount}{" "}
      error{errorCount === 1 ? "" : "es"}
    </p>
  );
}
