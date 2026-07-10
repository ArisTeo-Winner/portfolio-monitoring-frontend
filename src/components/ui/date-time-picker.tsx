"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { es } from "date-fns/locale";
import "react-day-picker/style.css";

type Props = {
  value: string;
  onChange: (value: string) => void;
  max?: string;
};

export function DateTimePicker({ value, onChange, max }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = parseLocalDateTime(value);
  const timeStr = parsed
    ? `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`
    : "00:00";

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleDaySelect(day: Date | undefined) {
    if (!day) return;
    const [hh, mm] = timeStr.split(":").map(Number);
    const next = new Date(day);
    next.setHours(hh, mm, 0, 0);
    onChange(toLocalDateTimeString(next));
    setOpen(false);
  }

  function handleTimeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const [hh, mm] = event.target.value.split(":").map(Number);
    const base = parsed ? new Date(parsed) : new Date();
    base.setHours(hh, mm, 0, 0);
    onChange(toLocalDateTimeString(base));
  }

  const maxDate = max ? parseLocalDateTime(max) : undefined;
  const displayLabel = parsed ? formatDisplay(parsed) : "Seleccionar fecha";

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        className="flex w-full items-center gap-2 bg-transparent text-left outline-none"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#6f7a8f]" />
        <span className="text-[0.84rem] font-medium text-white max-sm:text-[0.875rem]">
          {displayLabel}
        </span>
      </button>

      {/* Popover */}
      {open ? (
        <div
          className={[
            // Desktop base (lg+)
            "absolute left-0 top-full z-50 mt-2",
            "w-[18rem] overflow-hidden",
            "rounded-[1rem] border border-[#232931] bg-[#0f1318]",
            "shadow-[0_24px_56px_rgba(0,0,0,0.6)]",
            // Mobile override — full-width anchored to left edge of modal
            "max-sm:w-[calc(100vw-3rem)] max-sm:rounded-[0.875rem]",
          ].join(" ")}
        >
          <DayPicker
            captionLayout="dropdown"
            classNames={{
              root: "p-4 !font-sans max-sm:p-3",
              months: "relative",
              month: "space-y-3 max-sm:space-y-2",
              month_caption: "flex items-center justify-between gap-2 px-1 mb-1",
              caption_label: "sr-only",
              dropdowns: "flex items-center gap-1.5",
              dropdown_root: "relative",
              dropdown: [
                "appearance-none bg-[#14191f] text-white text-[0.78rem] font-semibold",
                "rounded-lg border border-[#232931] pl-2.5 pr-6 py-1.5 outline-none cursor-pointer",
                "transition hover:border-[#2f3742]",
                "max-sm:text-[0.72rem] max-sm:pl-2 max-sm:pr-5 max-sm:py-1",
              ].join(" "),
              nav: "flex items-center gap-1",
              button_previous: [
                "flex h-8 w-8 items-center justify-center rounded-lg",
                "border border-[#232931] bg-[#14191f] text-[#7f8aa3]",
                "transition hover:border-[#2f3742] hover:text-white",
                "max-sm:h-7 max-sm:w-7",
              ].join(" "),
              button_next: [
                "flex h-8 w-8 items-center justify-center rounded-lg",
                "border border-[#232931] bg-[#14191f] text-[#7f8aa3]",
                "transition hover:border-[#2f3742] hover:text-white",
                "max-sm:h-7 max-sm:w-7",
              ].join(" "),
              month_grid: "w-full border-collapse",
              weekdays: "flex",
              weekday: [
                "flex-1 text-center text-[0.68rem] font-semibold",
                "uppercase tracking-[0.08em] text-[#6f7a8f] pb-2",
                "max-sm:text-[0.62rem]",
              ].join(" "),
              weeks: "space-y-0.5",
              week: "flex",
              day: "flex-1 flex items-center justify-center p-0",
              day_button: [
                "h-9 w-9 rounded-lg text-[0.82rem] font-medium text-[#b0b8cc]",
                "transition hover:bg-[#1a2028] hover:text-white focus:outline-none",
                "max-sm:h-8 max-sm:w-8 max-sm:text-[0.78rem]",
              ].join(" "),
              selected: "[&>button]:!bg-[#3f8c53] [&>button]:!text-white",
              today: "[&>button]:font-bold [&>button]:text-[#4ade80]",
              outside: "[&>button]:text-[#3a404a]",
              disabled: [
                "[&>button]:text-[#3a404a] [&>button]:cursor-not-allowed",
                "[&>button]:hover:bg-transparent [&>button]:hover:text-[#3a404a]",
              ].join(" "),
            }}
            components={{
              Chevron: ({ orientation }) => {
                if (orientation === "left")  return <ChevronLeft  className="h-4 w-4 max-sm:h-3.5 max-sm:w-3.5" />;
                if (orientation === "right") return <ChevronRight className="h-4 w-4 max-sm:h-3.5 max-sm:w-3.5" />;
                return <span />;
              },
            }}
            disabled={maxDate ? { after: maxDate } : undefined}
            endMonth={maxDate ?? new Date()}
            locale={es}
            mode="single"
            startMonth={new Date(1970, 0)}
            selected={parsed ?? undefined}
            onSelect={handleDaySelect}
          />

          {/* Time section */}
          <div className="border-t border-[#1b2028] px-5 py-4 max-sm:px-4 max-sm:py-3">
            <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#6f7a8f] max-sm:mb-1.5 max-sm:text-[0.625rem]">
              Hora
            </p>
            <input
              className="w-full bg-transparent text-[0.875rem] font-medium text-white outline-none [color-scheme:dark] max-sm:text-[0.84rem]"
              max={
                maxDate && parsed && isSameDay(parsed, maxDate)
                  ? toTimeString(maxDate)
                  : undefined
              }
              onChange={handleTimeChange}
              type="time"
              value={timeStr}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function parseLocalDateTime(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toLocalDateTimeString(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

function formatDisplay(date: Date): string {
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
