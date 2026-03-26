"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { supabase, getUserId } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type Client = { id: string | number; name: string; email: string };
type BookingMode = "existing" | "general";

// ─── Constants ────────────────────────────────────────────────────────────────

const APPOINTMENT_TYPES = [
  "Consultation",
  "Full session",
  "Touch-up",
  "Flash piece",
  "Sleeve session",
];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Client search combobox ───────────────────────────────────────────────────

function ClientSearch({
  clients,
  selected,
  onSelect,
}: {
  clients: Client[];
  selected: Client | null;
  onSelect: (c: Client | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.email.toLowerCase().includes(query.toLowerCase())
      )
    : clients.slice(0, 8);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-[var(--nb-border)] bg-[var(--nb-active-bg)] px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-[var(--nb-text)]">{selected.name}</p>
          <p className="text-xs text-[var(--nb-text-2)]">{selected.email}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setQuery("");
          }}
          className="text-xs text-[#7C3AED] hover:underline shrink-0 ml-3"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--nb-text-2)] pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--nb-bg)] border border-[var(--nb-border)] rounded-lg outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors placeholder:text-[var(--nb-text-2)]"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-[var(--nb-border)] bg-[var(--nb-card)] shadow-lg">
          {filtered.map((c) => (
            <button
              key={String(c.id)}
              type="button"
              onClick={() => {
                onSelect(c);
                setQuery("");
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--nb-bg)] transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <div className="size-8 rounded-full bg-[var(--nb-active-bg)] flex items-center justify-center text-xs font-semibold text-[#7C3AED] shrink-0">
                {c.name
                  .trim()
                  .split(/\s+/)
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--nb-text)] truncate">
                  {c.name}
                </p>
                <p className="text-xs text-[var(--nb-text-2)] truncate">{c.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && query.trim() && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-[var(--nb-border)] bg-[var(--nb-card)] shadow-lg px-3 py-4 text-sm text-[var(--nb-text-2)] text-center">
          No clients found
        </div>
      )}
    </div>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  mode: "existing" as BookingMode,
  selectedClient: null as Client | null,
  bookingLabel: "",
  date: "",
  time: "10:00",
  apptType: "Consultation",
  status: "confirmed",
};

const selectCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 transition-colors";

export function BookAppointmentDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM, date: todayStr() });
  const [clients, setClients] = useState<Client[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch clients when dialog opens
  useEffect(() => {
    if (open) {
      getUserId().then((userId) => {
        if (!userId) return;
        supabase
          .from("clients")
          .select("id, name, email")
          .eq("user_id", userId)
          .order("name")
          .then(({ data }) => setClients((data as Client[]) ?? []));
      });
    }
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setForm({ ...EMPTY_FORM, date: todayStr() });
      setErrors({});
      setServerError(null);
    }
  }, [open]);

  function setField<K extends keyof typeof EMPTY_FORM>(
    key: K,
    value: (typeof EMPTY_FORM)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined! }));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (form.mode === "existing" && !form.selectedClient) {
      errs.client = "Please select a client";
    }
    if (form.mode === "general" && !form.bookingLabel.trim()) {
      errs.bookingLabel = "Please enter a name or note";
    }
    if (!form.date) errs.date = "Date is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError(null);

    const userId = await getUserId();
    if (!userId) { setServerError("Not authenticated"); setSubmitting(false); return; }

    // form.time is "HH:MM" from the native time input
    const time = form.time + ":00";

    const { data: inserted, error } = await supabase
      .from("appointments")
      .insert({
        user_id: userId,
        client_id: form.mode === "existing" ? form.selectedClient!.id : null,
        artist_name: form.mode === "general" ? form.bookingLabel.trim() : null,
        date: form.date,
        time,
        type: form.apptType,
        status: form.status,
      })
      .select("id")
      .single();

    setSubmitting(false);

    if (error) {
      setServerError(error.message);
      return;
    }

    // Fire-and-forget: schedule reminder emails if we have a client with an email
    if (inserted && form.mode === "existing" && form.selectedClient?.email) {
      fetch("/api/appointments/schedule-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: inserted.id,
          client_name: form.selectedClient.name,
          client_email: form.selectedClient.email,
          appointment_date: form.date,
          appointment_time: time,
          appointment_type: form.apptType,
        }),
      }).catch(() => {
        // Reminders are non-critical — don't block the UI
      });
    }

    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book Appointment</DialogTitle>
        </DialogHeader>

        <form
          id="book-appt-form"
          onSubmit={handleSubmit}
          className="space-y-4 pt-1"
        >
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-[var(--nb-border)] p-0.5 bg-[var(--nb-bg)] gap-0.5">
            {(["existing", "general"] as BookingMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setField("mode", mode)}
                className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
                  form.mode === mode
                    ? "bg-[var(--nb-card)] text-[#7C3AED] shadow-sm border border-[var(--nb-border)]"
                    : "text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
                }`}
              >
                {mode === "existing" ? "Existing Client" : "General Booking"}
              </button>
            ))}
          </div>

          {/* Client search or booking label */}
          {form.mode === "existing" ? (
            <div className="space-y-1.5">
              <Label>
                Client{" "}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <ClientSearch
                clients={clients}
                selected={form.selectedClient}
                onSelect={(c) => setField("selectedClient", c)}
              />
              {errors.client && (
                <p className="text-xs text-destructive">{errors.client}</p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="booking-label">
                Name / Note{" "}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Input
                id="booking-label"
                placeholder="e.g. Walk-in consultation, Portfolio shoot…"
                value={form.bookingLabel}
                onChange={(e) => setField("bookingLabel", e.target.value)}
                aria-invalid={!!errors.bookingLabel}
                autoComplete="off"
              />
              {errors.bookingLabel && (
                <p className="text-xs text-destructive">
                  {errors.bookingLabel}
                </p>
              )}
            </div>
          )}

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="appt-date">
                Date{" "}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Input
                id="appt-date"
                type="date"
                value={form.date}
                onChange={(e) => setField("date", e.target.value)}
                aria-invalid={!!errors.date}
              />
              {errors.date && (
                <p className="text-xs text-destructive">{errors.date}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appt-time">Time</Label>
              {/* Native time input — no controlled-select issues */}
              <input
                id="appt-time"
                type="time"
                value={form.time}
                min="09:00"
                max="18:00"
                onChange={(e) => setField("time", e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring transition-colors"
              />
            </div>
          </div>

          {/* Type + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="appt-type">Type</Label>
              <select
                id="appt-type"
                value={form.apptType}
                onChange={(e) => setField("apptType", e.target.value)}
                className={selectCls}
              >
                {APPOINTMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appt-status">Status</Label>
              <select
                id="appt-status"
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
                className={selectCls}
              >
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {serverError && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {serverError}
            </p>
          )}
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={submitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit"
            form="book-appt-form"
            disabled={submitting}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            {submitting ? "Booking…" : "Book Appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
