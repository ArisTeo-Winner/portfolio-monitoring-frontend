"use client";

import { useRef, useState } from "react";
import { ProblemAlert } from "@/components/ui/problem-alert";

/** One accent identity per currency the channel carries. */
export type ChannelAccent = "mxn" | "usd";

const ACCENT = {
  mxn: {
    spine: "bg-[#17c784]",
    ring: "border-[#17c784]/25",
    chip: "bg-[#0f2f24] text-[#20d48d]",
    watermark: "text-[#17c784]/[0.07]",
    tag: "border-[#17c784]/20 bg-[#17c784]/5 text-[#7fd9b4]",
    dropIdle: "border-[#232a35] hover:border-[#17c784]/50 hover:bg-[#17c784]/[0.04]",
    dropActive: "border-[#17c784] bg-[#17c784]/[0.08]",
    accentText: "text-[#20d48d]",
    spinner: "border-[#17c784] border-t-transparent",
  },
  usd: {
    spine: "bg-[#5aa9e6]",
    ring: "border-[#5aa9e6]/25",
    chip: "bg-[#132433] text-[#5aa9e6]",
    watermark: "text-[#5aa9e6]/[0.07]",
    tag: "border-[#5aa9e6]/20 bg-[#5aa9e6]/5 text-[#9bc7ec]",
    dropIdle: "border-[#232a35] hover:border-[#5aa9e6]/50 hover:bg-[#5aa9e6]/[0.04]",
    dropActive: "border-[#5aa9e6] bg-[#5aa9e6]/[0.08]",
    accentText: "text-[#5aa9e6]",
    spinner: "border-[#5aa9e6] border-t-transparent",
  },
} as const;

type Props = {
  accent: ChannelAccent;
  /** Three-letter currency code, doubles as the watermark. */
  currency: string;
  custodian: string;
  title: string;
  description: string;
  useCases: string[];
  /** Human copy for the load rule (e.g. "Un archivo por mes"). */
  loadRule: string;
  /** Whether the picker/dropzone accepts more than one file. */
  multiple: boolean;
  dropHint: string;
  uploading: boolean;
  error: string | null;
  onFiles: (files: File[]) => void;
  testid: string;
};

export function GbmChannelCard({
  accent,
  currency,
  custodian,
  title,
  description,
  useCases,
  loadRule,
  multiple,
  dropHint,
  uploading,
  error,
  onFiles,
  testid,
}: Props) {
  const styles = ACCENT[accent];
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  function emit(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    // A single-file channel only ever forwards the first PDF, honoring its rule.
    onFiles(multiple ? files : files.slice(0, 1));
  }

  function handleInput(event: React.ChangeEvent<HTMLInputElement>) {
    emit(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (uploading) return;
    emit(event.dataTransfer.files);
  }

  return (
    <section
      className={`relative flex flex-col overflow-hidden rounded-2xl border ${styles.ring} bg-[#0b0d10] pl-4 pr-4 py-4 sm:pl-5`}
      data-testid={testid}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${styles.spine}`} />
      <span
        aria-hidden
        className={`pointer-events-none absolute -right-3 -top-6 select-none font-mono text-[7rem] font-bold leading-none tracking-tighter ${styles.watermark}`}
      >
        {currency}
      </span>

      <div className="relative flex items-center gap-2">
        <span
          className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold tracking-widest ${styles.chip}`}
        >
          {currency}
        </span>
        <span className="text-[0.7rem] uppercase tracking-[0.18em] text-neutral-500">{custodian}</span>
      </div>

      <h4 className="relative mt-3 text-[0.95rem] font-semibold text-[#e6eaf1]">{title}</h4>
      <p className="relative mt-1 text-xs leading-5 text-[#8a94a6]">{description}</p>

      <ul className="relative mt-3 flex flex-wrap gap-1.5">
        {useCases.map((useCase) => (
          <li
            key={useCase}
            className={`rounded-full border px-2 py-0.5 text-[0.68rem] font-medium ${styles.tag}`}
          >
            {useCase}
          </li>
        ))}
      </ul>

      <p className="relative mt-3 flex items-center gap-1.5 text-[0.7rem] text-neutral-500">
        <RuleIcon className={styles.accentText} />
        <span>{loadRule}</span>
      </p>

      <button
        type="button"
        aria-busy={uploading}
        className={`relative mt-3 flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-3 py-4 text-center transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d10] disabled:cursor-not-allowed disabled:opacity-70 ${
          dragging ? styles.dropActive : styles.dropIdle
        }`}
        data-testid={`${testid}-drop`}
        data-dragging={dragging}
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {uploading ? (
          <>
            <span
              aria-hidden
              className={`h-5 w-5 animate-spin rounded-full border-2 ${styles.spinner}`}
            />
            <span className="text-xs font-medium text-[#e6eaf1]">Subiendo…</span>
          </>
        ) : (
          <>
            <UploadIcon className={styles.accentText} />
            <span className="text-xs font-medium text-[#e6eaf1]">{dropHint}</span>
            <span className="text-[0.68rem] text-neutral-500">
              Arrastra {multiple ? "o suéltalos aquí" : "o suéltalo aquí"} · solo .pdf
            </span>
          </>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        data-testid={`${testid}-input`}
        multiple={multiple}
        onChange={handleInput}
      />

      {error ? <ProblemAlert className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400" message={error} /> : null}
    </section>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="none" height="20" viewBox="0 0 24 24" width="20">
      <path d="M12 15V4m0 0 4 4m-4-4L8 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    </svg>
  );
}

function RuleIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="none" height="13" viewBox="0 0 24 24" width="13">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 11v5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <circle cx="12" cy="7.5" fill="currentColor" r="1" />
    </svg>
  );
}
