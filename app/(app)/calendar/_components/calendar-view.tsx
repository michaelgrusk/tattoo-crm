"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 64; // px per hour
const START_HOUR = 9;
const END_HOUR = 18;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, i) => START_HOUR + i
);
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// ─── Types ────────────────────────────────────────────────────────────────────

type Appointment = {
  id: string;
  client_id: string;
  date: string;
  time: string;
  type: string;
  status: string;
  artist_name: string;
  clients: { name: string } | null;
};

// ─── Color mapping (deterministic by type string) ─────────────────────────────

const TYPE_COLORS = [
  { bg: "bg-teal-100", border: "border-teal-200", text: "text-teal-800" },
  { bg: "bg-amber-100", border: "border-amber-200", text: "text-amber-800" },
  { bg: "bg-violet-100", border: "border-violet-200", text: "text-violet-800" },
  { bg: "bg-sky-100", border: "border-sky-200", text: "text-sky-800" },
  { bg: "bg-rose-100", border: "border-rose-200", text: "text-rose-800" },
];

function getTypeColor(type: string) {
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = type.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TYPE_COLORS[Math.abs(hash) % TYPE_COLORS.length];
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns Monday of the week containing `date` (local time). */
function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

/** Mon–Fri array for the week starting at `monday`. */
function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** Local YYYY-MM-DD string (avoids UTC offset shifting the date). */
function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatHour(hour: number): string {
  if (hour === 12) return "12 PM";
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
}

function formatWeekRange(days: Date[]): string {
  const s = days[0];
  const e = days[4];
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const sStr = s.toLocaleDateString("en-US", opts);
  if (s.getMonth() === e.getMonth()) {
    return `${sStr} – ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${sStr} – ${e.toLocaleDateString("en-US", opts)}, ${e.getFullYear()}`;
}

/** Pixels from the top of the grid for a given HH:MM(:SS) time string. */
function timeToTop(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return ((h - START_HOUR) + m / 60) * HOUR_HEIGHT;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AppointmentBlock({ appt }: { appt: Appointment }) {
  const top = timeToTop(appt.time);
  if (top < 0 || top >= HOURS.length * HOUR_HEIGHT) return null;
  const color = getTypeColor(appt.type);

  return (
    <div
      className={`absolute left-1 right-1 rounded-lg px-2 py-1.5 border overflow-hidden cursor-pointer transition-all hover:brightness-[0.96] hover:shadow-sm ${color.bg} ${color.border}`}
      style={{ top: top + 2, height: HOUR_HEIGHT - 6 }}
    >
      <p className={`text-xs font-semibold leading-tight truncate ${color.text}`}>
        {appt.clients?.name ?? "Client"}
      </p>
      <p className={`text-[11px] mt-0.5 leading-tight truncate opacity-75 ${color.text}`}>
        {appt.type}
      </p>
    </div>
  );
}

function DayColumn({
  day,
  isToday,
  appointments,
}: {
  day: Date;
  isToday: boolean;
  appointments: Appointment[];
}) {
  const totalHeight = HOURS.length * HOUR_HEIGHT;

  return (
    <div
      className={`flex-1 relative border-l border-[#EEF5F8] ${
        isToday ? "bg-[#FAFEFF]" : "bg-white"
      }`}
      style={{ height: totalHeight }}
    >
      {/* Horizontal hour lines */}
      {HOURS.map((_, i) => (
        <div
          key={i}
          className="absolute inset-x-0 border-t border-[#EEF5F8]"
          style={{ top: i * HOUR_HEIGHT }}
        />
      ))}
      {/* Bottom border */}
      <div
        className="absolute inset-x-0 border-t border-[#EEF5F8]"
        style={{ top: totalHeight }}
      />
      {/* Appointments */}
      {appointments.map((appt) => (
        <AppointmentBlock key={appt.id} appt={appt} />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CalendarView() {
  const [weekStart, setWeekStart] = useState<Date>(() =>
    getMonday(new Date())
  );
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

  const weekDays = getWeekDays(weekStart);
  const todayStr = toDateStr(new Date());

  // Fetch appointments whenever the displayed week changes
  useEffect(() => {
    setLoading(true);
    const days = getWeekDays(weekStart);
    const start = toDateStr(days[0]);
    const end = toDateStr(days[4]);

    supabase
      .from("appointments")
      .select("*, clients(name)")
      .gte("date", start)
      .lte("date", end)
      .then(({ data }) => {
        setAppointments((data as Appointment[]) ?? []);
        setLoading(false);
      });
  }, [weekStart]);

  // Scroll to 9am on first load
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollTop = 0;
    }
  }, []);

  function shiftWeek(delta: number) {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
  }

  function goToToday() {
    setWeekStart(getMonday(new Date()));
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#D6EAF0] shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftWeek(-1)}
            className="size-8 flex items-center justify-center rounded-lg border border-[#D6EAF0] hover:bg-[#F0F7FA] transition-colors"
          >
            <ChevronLeft size={16} className="text-gray-500" />
          </button>
          <button
            onClick={() => shiftWeek(1)}
            className="size-8 flex items-center justify-center rounded-lg border border-[#D6EAF0] hover:bg-[#F0F7FA] transition-colors"
          >
            <ChevronRight size={16} className="text-gray-500" />
          </button>
          <h2 className="text-base font-semibold text-gray-900 ml-1 min-w-48">
            {formatWeekRange(weekDays)}
          </h2>
          {loading && (
            <Loader2 size={14} className="animate-spin text-gray-400" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 rounded-lg border border-[#D6EAF0] hover:bg-[#F0F7FA] transition-colors"
          >
            Today
          </button>
          <Button className="bg-[#1A8FAF] hover:bg-[#157a97] text-white gap-1.5">
            <Plus size={15} />
            Book Appointment
          </Button>
        </div>
      </div>

      {/* ── Day header row ───────────────────────────────────────────────── */}
      <div className="flex border-b border-[#D6EAF0] shrink-0 bg-white">
        {/* Time gutter spacer */}
        <div className="w-16 shrink-0" />
        {weekDays.map((day, i) => {
          const isToday = toDateStr(day) === todayStr;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center py-3 border-l border-[#D6EAF0] select-none"
            >
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                {DAY_LABELS[i]}
              </span>
              <div
                className={`mt-1.5 size-8 flex items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  isToday
                    ? "bg-[#1A8FAF] text-white"
                    : "text-gray-800 hover:bg-[#F0F7FA]"
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Scrollable grid ──────────────────────────────────────────────── */}
      <div ref={gridRef} className="flex-1 overflow-y-auto">
        <div className="flex">
          {/* Time labels */}
          <div className="w-16 shrink-0 select-none bg-white z-10">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="flex items-start justify-end pr-3"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="text-[11px] text-gray-400 pt-1.5 leading-none">
                  {formatHour(hour)}
                </span>
              </div>
            ))}
            {/* Final label at 6 PM */}
            <div className="flex items-start justify-end pr-3 h-0 overflow-visible">
              <span className="text-[11px] text-gray-400 -mt-1.5 leading-none">
                {formatHour(END_HOUR)}
              </span>
            </div>
          </div>

          {/* Day columns */}
          {weekDays.map((day, i) => {
            const dateStr = toDateStr(day);
            return (
              <DayColumn
                key={i}
                day={day}
                isToday={dateStr === todayStr}
                appointments={appointments.filter((a) => a.date === dateStr)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
