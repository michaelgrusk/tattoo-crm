"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, Loader2, CheckCircle2, X, Banknote } from "lucide-react";
import { supabase, getUserId } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { BookAppointmentDialog } from "./book-appointment-dialog";
import { DepositModal } from "./deposit-modal";

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 64; // px per hour
const START_HOUR = 7;
const END_HOUR = 22;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, i) => START_HOUR + i
);
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Types ────────────────────────────────────────────────────────────────────

type Appointment = {
  id: string;
  client_id: string | null;
  date: string;
  time: string;
  type: string;
  status: string;
  artist_name: string | null;
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

/** Mon–Sun array for the week starting at `monday`. */
function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
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
  const e = days[6];
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

function formatApptTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function AppointmentBlock({ appt, onClick }: { appt: Appointment; onClick: () => void }) {
  const top = timeToTop(appt.time);
  if (top < 0 || top >= HOURS.length * HOUR_HEIGHT) return null;
  const color = getTypeColor(appt.type);

  return (
    <div
      onClick={onClick}
      className={`absolute left-1 right-1 rounded-lg px-2 py-1.5 border overflow-hidden cursor-pointer transition-all hover:brightness-[0.96] hover:shadow-sm ${color.bg} ${color.border}`}
      style={{ top: top + 2, height: HOUR_HEIGHT - 6 }}
    >
      <p className={`text-xs font-semibold leading-tight truncate ${color.text}`}>
        {appt.clients?.name ?? appt.artist_name ?? "Appointment"}
      </p>
      <p className={`text-[11px] mt-0.5 leading-tight truncate opacity-60 ${color.text}`}>
        {formatApptTime(appt.time)}
      </p>
    </div>
  );
}

function DayColumn({
  day,
  isToday,
  appointments,
  onAppointmentClick,
}: {
  day: Date;
  isToday: boolean;
  appointments: Appointment[];
  onAppointmentClick: (appt: Appointment) => void;
}) {
  const totalHeight = HOURS.length * HOUR_HEIGHT;

  return (
    <div
      className={`flex-1 relative border-l border-[var(--nb-card)] ${
        isToday ? "bg-[#FAFEFF]" : "bg-[var(--nb-card)]"
      }`}
      style={{ height: totalHeight }}
    >
      {/* Horizontal hour lines */}
      {HOURS.map((_, i) => (
        <div
          key={i}
          className="absolute inset-x-0 border-t border-[var(--nb-card)]"
          style={{ top: i * HOUR_HEIGHT }}
        />
      ))}
      {/* Bottom border */}
      <div
        className="absolute inset-x-0 border-t border-[var(--nb-card)]"
        style={{ top: totalHeight }}
      />
      {/* Appointments */}
      {appointments.map((appt) => (
        <AppointmentBlock key={appt.id} appt={appt} onClick={() => onAppointmentClick(appt)} />
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editType, setEditType] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const weekDays = getWeekDays(weekStart);
  const todayStr = toDateStr(new Date());

  // Stable fetch function — useCallback with weekStart dep so it always
  // fetches the right week and can safely be called from anywhere.
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    const days = getWeekDays(weekStart);
    const start = toDateStr(days[0]);
    const end = toDateStr(days[6]);

    const userId = await getUserId();
    if (!userId) { setLoading(false); return; }

    const { data, error } = await supabase
      .from("appointments")
      .select("id, client_id, date, time, type, status, artist_name, clients(name)")
      .eq("user_id", userId)
      .gte("date", start)
      .lte("date", end)
      .order("date")
      .order("time");

    if (error) {
      console.error("[calendar] fetch error:", error.message, error);
    }

    setAppointments((data as unknown as Appointment[]) ?? []);
    setLoading(false);
  }, [weekStart]);

  // Run on mount and whenever the week changes
  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  function fireToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(message);
    setShowToast(true);
    toastTimer.current = setTimeout(() => setShowToast(false), 3500);
  }

  function handleBookingSuccess() {
    fetchAppointments();
    fireToast("Appointment booked!");
  }

  function openEditMode() {
    if (!selectedAppt) return;
    setEditDate(selectedAppt.date);
    setEditTime(selectedAppt.time.slice(0, 5)); // HH:MM
    setEditType(selectedAppt.type);
    setEditStatus(selectedAppt.status);
    setEditMode(true);
  }

  function closeAppt() {
    setSelectedAppt(null);
    setDeleteConfirm(false);
    setEditMode(false);
    setDepositOpen(false);
  }

  async function handleSaveEdit() {
    if (!selectedAppt || !editDate) return;
    setSaving(true);
    const { error } = await supabase
      .from("appointments")
      .update({
        date: editDate,
        time: editTime + ":00",
        type: editType,
        status: editStatus,
      })
      .eq("id", selectedAppt.id);
    setSaving(false);
    if (error) return;
    closeAppt();
    fetchAppointments();
    fireToast("Appointment updated");
  }

  async function handleDeleteAppointment() {
    if (!selectedAppt) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setDeleting(true);
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", selectedAppt.id);
    setDeleting(false);
    if (error) return; // keep modal open on error
    setSelectedAppt(null);
    setDeleteConfirm(false);
    fetchAppointments();
    fireToast("Appointment deleted");
  }

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
    <div className="flex flex-col h-full overflow-hidden bg-[var(--nb-card)]">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-[var(--nb-border)] shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => shiftWeek(-1)}
            className="size-8 flex items-center justify-center rounded-lg border border-[var(--nb-border)] hover:bg-[var(--nb-bg)] transition-colors shrink-0"
          >
            <ChevronLeft size={16} className="text-[var(--nb-text-2)]" />
          </button>
          <button
            onClick={() => shiftWeek(1)}
            className="size-8 flex items-center justify-center rounded-lg border border-[var(--nb-border)] hover:bg-[var(--nb-bg)] transition-colors shrink-0"
          >
            <ChevronRight size={16} className="text-[var(--nb-text-2)]" />
          </button>
          <h2 className="text-sm md:text-base font-semibold text-[var(--nb-text)] ml-1 truncate">
            {formatWeekRange(weekDays)}
          </h2>
          {loading && (
            <Loader2 size={14} className="animate-spin text-[var(--nb-text-2)] shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm font-medium text-[var(--nb-text-2)] rounded-lg border border-[var(--nb-border)] hover:bg-[var(--nb-bg)] transition-colors"
          >
            Today
          </button>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5"
            size="sm"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Book Appointment</span>
            <span className="sm:hidden">Book</span>
          </Button>
        </div>
      </div>

      {/* ── Mobile week list (hidden on lg+) ─────────────────────────── */}
      <div className="lg:hidden flex-1 overflow-y-auto bg-[var(--nb-bg)]">
        {weekDays.map((day) => {
          const dateStr = toDateStr(day);
          const dayAppts = appointments.filter((a) => a.date === dateStr);
          const isToday = dateStr === todayStr;
          return (
            <div key={dateStr}>
              <div className={`px-4 py-2 flex items-center gap-2 sticky top-0 z-10 border-b border-[var(--nb-border)] ${isToday ? "bg-[#7C3AED]/10" : "bg-[var(--nb-bg)]"}`}>
                <div className={`size-7 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${isToday ? "bg-[#7C3AED] text-white" : "text-[var(--nb-text-2)]"}`}>
                  {day.getDate()}
                </div>
                <span className={`text-sm font-semibold ${isToday ? "text-[#7C3AED]" : "text-[var(--nb-text-2)]"}`}>
                  {day.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                </span>
              </div>
              {dayAppts.length === 0 ? (
                <div className="px-4 py-3 text-xs text-[var(--nb-text-2)] italic">No appointments</div>
              ) : (
                <div className="divide-y divide-[var(--nb-border)]">
                  {dayAppts.map((appt) => {
                    const color = getTypeColor(appt.type);
                    return (
                      <button
                        key={appt.id}
                        onClick={() => setSelectedAppt(appt)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[var(--nb-card)] transition-colors`}
                      >
                        <div className={`w-1 self-stretch rounded-full shrink-0 ${color.bg} border ${color.border}`} />
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${color.text}`}>
                            {appt.clients?.name ?? appt.artist_name ?? "Appointment"}
                          </p>
                          <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                            {formatApptTime(appt.time)} · {appt.type}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Day header row (hidden on mobile) ───────────────────────────── */}
      <div className="hidden lg:flex border-b border-[var(--nb-border)] shrink-0 bg-[var(--nb-card)]">
        {/* Time gutter spacer */}
        <div className="w-16 shrink-0" />
        {weekDays.map((day, i) => {
          const isToday = toDateStr(day) === todayStr;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center py-3 border-l border-[var(--nb-border)] select-none"
            >
              <span className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-widest">
                {DAY_LABELS[i]}
              </span>
              <div
                className={`mt-1.5 size-8 flex items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  isToday
                    ? "bg-[#7C3AED] text-white"
                    : "text-[var(--nb-text)] hover:bg-[var(--nb-bg)]"
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Scrollable grid (hidden on mobile) ───────────────────────────── */}
      <div ref={gridRef} className="hidden lg:block flex-1 overflow-y-auto">
        <div className="flex">
          {/* Time labels */}
          <div className="w-16 shrink-0 select-none bg-[var(--nb-card)] z-10">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="flex items-start justify-end pr-3"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="text-[11px] text-[var(--nb-text-2)] pt-1.5 leading-none">
                  {formatHour(hour)}
                </span>
              </div>
            ))}
            {/* Final label at 6 PM */}
            <div className="flex items-start justify-end pr-3 h-0 overflow-visible">
              <span className="text-[11px] text-[var(--nb-text-2)] -mt-1.5 leading-none">
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
                onAppointmentClick={setSelectedAppt}
              />
            );
          })}
        </div>
      </div>

      {/* Appointment detail dialog */}
      {selectedAppt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={closeAppt}
        >
          <div
            className="bg-[var(--nb-card)] rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--nb-border)]">
              <h3 className="text-base font-semibold text-[var(--nb-text)]">
                {editMode ? "Edit Appointment" : "Appointment Details"}
              </h3>
              <button
                onClick={closeAppt}
                className="size-7 flex items-center justify-center rounded-lg hover:bg-[var(--nb-bg)] transition-colors text-[var(--nb-text-2)] hover:text-[var(--nb-text-2)]"
              >
                <X size={16} />
              </button>
            </div>

            {!editMode ? (
              <>
                {/* Body — detail view */}
                <div className="px-5 py-4 space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">Client</p>
                    <p className="text-sm font-medium text-[var(--nb-text)]">
                      {selectedAppt.clients?.name ?? selectedAppt.artist_name ?? "—"}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">Date</p>
                      <p className="text-sm text-[var(--nb-text)]">
                        {new Date(selectedAppt.date + "T00:00:00").toLocaleDateString("en-US", {
                          weekday: "short", month: "short", day: "numeric",
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">Time</p>
                      <p className="text-sm text-[var(--nb-text)]">
                        {(() => {
                          const [h, m] = selectedAppt.time.split(":").map(Number);
                          const ampm = h >= 12 ? "PM" : "AM";
                          const hour = h % 12 || 12;
                          return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
                        })()}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">Type</p>
                    <p className="text-sm text-[var(--nb-text)]">{selectedAppt.type}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">Status</p>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      selectedAppt.status === "confirmed"
                        ? "bg-emerald-50 text-emerald-700"
                        : selectedAppt.status === "cancelled"
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-700"
                    }`}>
                      <span className={`size-1.5 rounded-full ${
                        selectedAppt.status === "confirmed"
                          ? "bg-emerald-400"
                          : selectedAppt.status === "cancelled"
                          ? "bg-red-400"
                          : "bg-amber-400"
                      }`} />
                      {selectedAppt.status.charAt(0).toUpperCase() + selectedAppt.status.slice(1)}
                    </span>
                  </div>
                </div>
                {/* Footer — detail */}
                <div className="px-5 py-3 border-t border-[var(--nb-border)] flex items-center justify-between">
                  <button
                    onClick={handleDeleteAppointment}
                    disabled={deleting}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                      deleteConfirm
                        ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                        : "bg-[var(--nb-card)] text-[var(--nb-text-2)] border-[var(--nb-border)] hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    }`}
                  >
                    {deleting && <Loader2 size={12} className="animate-spin" />}
                    {deleteConfirm ? "Confirm Delete?" : "Delete"}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDepositOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    >
                      <Banknote size={12} />
                      Deposit
                    </button>
                    <button
                      onClick={openEditMode}
                      className="px-3 py-1.5 text-xs font-medium text-[#7C3AED] rounded-lg border border-[var(--nb-border)] hover:bg-[var(--nb-bg)] transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={closeAppt}
                      className="px-4 py-1.5 text-sm font-medium text-[var(--nb-text-2)] rounded-lg border border-[var(--nb-border)] hover:bg-[var(--nb-bg)] transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Body — edit view */}
                <div className="px-5 py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">Date</label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-[#7C3AED] transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">Time</label>
                      <input
                        type="time"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-[#7C3AED] transition-colors"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">Type</label>
                    <input
                      type="text"
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-[#7C3AED] transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-[#7C3AED] transition-colors"
                    >
                      <option value="confirmed">Confirmed</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
                {/* Footer — edit */}
                <div className="px-5 py-3 border-t border-[var(--nb-border)] flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEditMode(false)}
                    disabled={saving}
                    className="px-4 py-1.5 text-sm font-medium text-[var(--nb-text-2)] rounded-lg border border-[var(--nb-border)] hover:bg-[var(--nb-bg)] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving || !editDate}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving && <Loader2 size={12} className="animate-spin" />}
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Deposit modal */}
      {depositOpen && selectedAppt && (
        <DepositModal
          appointmentId={selectedAppt.id}
          clientName={selectedAppt.clients?.name ?? selectedAppt.artist_name ?? "Client"}
          clientEmail={undefined}
          defaultDescription={`${selectedAppt.type} deposit — ${selectedAppt.clients?.name ?? selectedAppt.artist_name ?? "Client"}`}
          onClose={() => setDepositOpen(false)}
        />
      )}

      {/* Book Appointment dialog */}
      <BookAppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleBookingSuccess}
      />

      {/* Success toast */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium bg-emerald-600 text-white animate-in slide-in-from-bottom-4 fade-in duration-200">
          <CheckCircle2 size={16} className="shrink-0" />
          {toastMessage}
        </div>
      )}
    </div>
  );
}
