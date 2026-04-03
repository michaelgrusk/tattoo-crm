"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type IntakeAvailabilityBlock = {
  start_date: string;
  end_date: string;
  block_type: "blocked" | "available";
  label: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDateStatus(
  dateStr: string,
  blocks: IntakeAvailabilityBlock[]
): "blocked" | "available" | null {
  let hasAvailable = false;
  for (const b of blocks) {
    if (dateStr >= b.start_date && dateStr <= b.end_date) {
      if (b.block_type === "blocked") return "blocked";
      hasAvailable = true;
    }
  }
  return hasAvailable ? "available" : null;
}

function getBlockedLabel(dateStr: string, blocks: IntakeAvailabilityBlock[]): string {
  for (const b of blocks) {
    if (dateStr >= b.start_date && dateStr <= b.end_date && b.block_type === "blocked") {
      return b.label ?? "Fully Booked";
    }
  }
  return "Fully Booked";
}

function getMonthDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];
  const startDow = firstDay.getDay();
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

const DOW_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ─── Component ────────────────────────────────────────────────────────────────

export function AvailabilityDatePicker({
  value,
  onChange,
  blocks,
}: {
  value: string;
  onChange: (date: string) => void;
  blocks: IntakeAvailabilityBlock[];
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);

  const initial = value
    ? new Date(value + "T00:00:00")
    : today;

  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [hoveredBlocked, setHoveredBlocked] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const days = getMonthDays(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
    month: "long", year: "numeric",
  });

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  const displayValue = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
      })
    : null;

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm text-left transition-colors ${
          open
            ? "border-[#7C3AED] ring-2 ring-[#7C3AED]/20 bg-[var(--nb-card)]"
            : "border-[var(--nb-border)] bg-[var(--nb-card)] hover:border-[#7C3AED]/40"
        }`}
      >
        <span className={value ? "text-[var(--nb-text)]" : "text-[var(--nb-text-2)]"}>
          {displayValue ?? "Select a date"}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-[var(--nb-text-2)] transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Calendar dropdown */}
      {open && (
        <div className="mt-2 bg-[var(--nb-card)] rounded-2xl border border-[var(--nb-border)] shadow-xl overflow-hidden z-20 relative">
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--nb-border)]">
            <button
              type="button"
              onClick={prevMonth}
              className="size-7 flex items-center justify-center rounded-lg hover:bg-[var(--nb-bg)] transition-colors"
            >
              <ChevronLeft size={14} className="text-[var(--nb-text-2)]" />
            </button>
            <span className="text-sm font-semibold text-[var(--nb-text)]">{monthLabel}</span>
            <button
              type="button"
              onClick={nextMonth}
              className="size-7 flex items-center justify-center rounded-lg hover:bg-[var(--nb-bg)] transition-colors"
            >
              <ChevronRight size={14} className="text-[var(--nb-text-2)]" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 px-2 pt-2">
            {DOW_LABELS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-[var(--nb-text-2)] py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5 px-2 pb-3">
            {days.map((day, i) => {
              if (!day) return <div key={i} />;
              const ds = toDateStr(day);
              const status = getDateStatus(ds, blocks);
              const isPast = day < today;
              const isBlocked = status === "blocked";
              const isAvailable = status === "available";
              const isSelected = ds === value;
              const isToday = ds === todayStr;
              const isDisabled = isPast || isBlocked;
              const blockedLabel = isBlocked ? getBlockedLabel(ds, blocks) : "";

              return (
                <div key={i} className="relative flex items-center justify-center py-0.5 group">
                  {/* Blocked tooltip */}
                  {isBlocked && hoveredBlocked === ds && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-lg bg-[var(--nb-text)] text-[var(--nb-card)] text-[10px] font-medium whitespace-nowrap z-30 pointer-events-none shadow-lg">
                      {blockedLabel}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (!isDisabled) {
                        onChange(ds);
                        setOpen(false);
                      }
                    }}
                    onMouseEnter={() => isBlocked ? setHoveredBlocked(ds) : undefined}
                    onMouseLeave={() => setHoveredBlocked(null)}
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all relative
                      ${isSelected
                        ? "bg-[#7C3AED] text-white shadow-sm"
                        : isBlocked
                        ? "bg-red-100 text-red-300 cursor-not-allowed"
                        : isPast
                        ? "text-[var(--nb-text-2)] opacity-30 cursor-not-allowed"
                        : isAvailable
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                        : "text-[var(--nb-text)] hover:bg-[var(--nb-active-bg)] hover:text-[#7C3AED]"}
                    `}
                  >
                    {isToday && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-[#7C3AED]" />
                    )}
                    {day.getDate()}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-t border-[var(--nb-border)] bg-[var(--nb-bg)]">
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-full bg-red-200" />
              <span className="text-[10px] text-[var(--nb-text-2)]">Unavailable</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-full bg-emerald-300" />
              <span className="text-[10px] text-[var(--nb-text-2)]">Open slot</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2.5 rounded-full bg-[#7C3AED]" />
              <span className="text-[10px] text-[var(--nb-text-2)]">Selected</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
