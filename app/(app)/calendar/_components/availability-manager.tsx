"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Loader2, Calendar, Info } from "lucide-react";
import { supabase, getUserId } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AvailabilityBlock = {
  id: number;
  start_date: string;
  end_date: string;
  block_type: "blocked" | "available";
  label: string | null;
  notes: string | null;
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
  blocks: AvailabilityBlock[]
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

function getMonthDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: (Date | null)[] = [];
  const startDow = firstDay.getDay(); // 0 = Sun
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Mini month calendar ──────────────────────────────────────────────────────

function MonthCalendar({
  blocks,
  year,
  month,
}: {
  blocks: AvailabilityBlock[];
  year: number;
  month: number;
}) {
  const todayStr = toDateStr(new Date());
  const days = getMonthDays(year, month);

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DOW_LABELS.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-[var(--nb-text-2)] py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-[var(--nb-border)] rounded-xl overflow-hidden">
        {days.map((day, i) => {
          if (!day) return <div key={i} className="bg-[var(--nb-bg)] h-9" />;
          const ds = toDateStr(day);
          const status = getDateStatus(ds, blocks);
          const isToday = ds === todayStr;
          const isPast = ds < todayStr;

          return (
            <div
              key={i}
              title={
                status === "blocked" ? "Blocked" :
                status === "available" ? "Available" : undefined
              }
              className={`h-9 flex items-center justify-center relative
                ${status === "blocked"
                  ? "bg-red-50"
                  : status === "available"
                  ? "bg-emerald-50"
                  : "bg-[var(--nb-bg)]"}
              `}
            >
              {isToday && (
                <div className="absolute inset-0 ring-2 ring-inset ring-[#7C3AED]/40 pointer-events-none" />
              )}
              <span
                className={`text-xs font-medium select-none
                  ${status === "blocked" ? "text-red-700" :
                    status === "available" ? "text-emerald-700" :
                    isPast ? "text-[var(--nb-text-2)] opacity-40" :
                    "text-[var(--nb-text)]"}
                  ${isToday ? "font-bold" : ""}
                `}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-red-100 border border-red-200" />
          <span className="text-xs text-[var(--nb-text-2)]">Blocked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-emerald-100 border border-emerald-200" />
          <span className="text-xs text-[var(--nb-text-2)]">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="size-3 rounded-sm bg-[var(--nb-bg)] border border-[var(--nb-border)]" />
          <span className="text-xs text-[var(--nb-text-2)]">Unset</span>
        </div>
      </div>
    </div>
  );
}

// ─── Add block modal ──────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-2.5 text-sm text-[var(--nb-text)] outline-none placeholder:text-[var(--nb-text-2)] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors";

function AddBlockModal({
  open,
  editingBlock,
  onClose,
  onSaved,
}: {
  open: boolean;
  editingBlock?: AvailabilityBlock | null;
  onClose: () => void;
  onSaved: (block: AvailabilityBlock) => void;
}) {
  const isEdit = !!editingBlock;
  const [blockType, setBlockType] = useState<"blocked" | "available">("blocked");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [label, setLabel] = useState("Fully booked");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset / pre-fill on open
  useEffect(() => {
    if (open) {
      if (editingBlock) {
        setBlockType(editingBlock.block_type);
        setStartDate(editingBlock.start_date);
        setEndDate(editingBlock.end_date);
        setLabel(editingBlock.label ?? (editingBlock.block_type === "blocked" ? "Fully booked" : "Available for bookings"));
        setNotes(editingBlock.notes ?? "");
      } else {
        setBlockType("blocked");
        setStartDate("");
        setEndDate("");
        setLabel("Fully booked");
        setNotes("");
      }
      setError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-update label when type changes (only for new blocks)
  useEffect(() => {
    if (!isEdit) {
      setLabel(blockType === "blocked" ? "Fully booked" : "Available for bookings");
    }
  }, [blockType, isEdit]);

  async function handleSave() {
    if (!startDate || !endDate) { setError("Start and end dates are required"); return; }
    if (endDate < startDate) { setError("End date must be on or after start date"); return; }
    setSaving(true);
    setError(null);
    const userId = await getUserId();
    if (!userId) { setError("Not authenticated"); setSaving(false); return; }

    const payload = {
      start_date: startDate,
      end_date: endDate,
      block_type: blockType,
      label: label.trim() || null,
      notes: notes.trim() || null,
    };

    let data: AvailabilityBlock | null = null;
    let dbError: { message: string } | null = null;

    if (isEdit && editingBlock) {
      const result = await supabase
        .from("availability_blocks")
        .update(payload)
        .eq("id", editingBlock.id)
        .select()
        .single();
      data = result.data as AvailabilityBlock;
      dbError = result.error;
    } else {
      const result = await supabase
        .from("availability_blocks")
        .insert({ user_id: userId, ...payload })
        .select()
        .single();
      data = result.data as AvailabilityBlock;
      dbError = result.error;
    }

    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    onSaved(data!);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Availability Block" : "Add Availability Block"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Type selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setBlockType("blocked")}
              className={`flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-xl border-2 text-sm font-medium transition-all ${
                blockType === "blocked"
                  ? "border-red-400 bg-red-50 text-red-700"
                  : "border-[var(--nb-border)] text-[var(--nb-text-2)] hover:border-red-200 bg-[var(--nb-card)]"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
              </svg>
              Block dates
              <span className="text-[10px] font-normal opacity-70">Unavailable</span>
            </button>
            <button
              type="button"
              onClick={() => setBlockType("available")}
              className={`flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-xl border-2 text-sm font-medium transition-all ${
                blockType === "available"
                  ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                  : "border-[var(--nb-border)] text-[var(--nb-text-2)] hover:border-emerald-200 bg-[var(--nb-card)]"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              Open dates
              <span className="text-[10px] font-normal opacity-70">Available</span>
            </button>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--nb-text)] mb-1.5">
                Start date <span className="text-[#7C3AED]">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--nb-text)] mb-1.5">
                End date <span className="text-[#7C3AED]">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-[var(--nb-text)] mb-1.5">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='e.g. "Fully booked" or "Summer availability"'
              className={inputCls}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-[var(--nb-text)] mb-1.5">
              Notes <span className="text-xs font-normal text-[var(--nb-text-2)]">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. On holiday, back in 2 weeks"
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-[var(--nb-border)] text-sm font-medium text-[var(--nb-text-2)] hover:bg-[var(--nb-bg)] transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {isEdit ? "Update Block" : "Save Block"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AvailabilityManager() {
  const today = new Date();
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<AvailabilityBlock | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const fetchBlocks = useCallback(async () => {
    const userId = await getUserId();
    if (!userId) { setLoading(false); return; }
    const { data } = await supabase
      .from("availability_blocks")
      .select("*")
      .eq("user_id", userId)
      .order("start_date", { ascending: true });
    setBlocks((data as AvailabilityBlock[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  async function handleDelete(id: number) {
    setDeleting(id);
    await supabase.from("availability_blocks").delete().eq("id", id);
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setDeleting(null);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
    month: "long", year: "numeric",
  });

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--nb-bg)] p-4 md:p-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--nb-text)]">Availability</h2>
          <p className="text-sm text-[var(--nb-text-2)] mt-0.5">
            Control when clients can request appointments
          </p>
        </div>
        <button
          onClick={() => { setEditingBlock(null); setModalOpen(true); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium transition-colors shrink-0"
        >
          <Plus size={14} />
          Add Block
        </button>
      </div>

      {/* Tip */}
      <div className="flex items-start gap-2.5 rounded-xl border border-[var(--nb-border)] bg-[var(--nb-card)] px-4 py-3">
        <Info size={14} className="text-[#7C3AED] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--nb-text-2)] leading-relaxed">
          Blocked dates will show as unavailable on your intake form. Open dates signal to clients when you&apos;re taking bookings.
        </p>
      </div>

      {/* Month calendar */}
      <div className="bg-[var(--nb-card)] rounded-2xl border border-[var(--nb-border)] p-4 md:p-5">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="size-8 flex items-center justify-center rounded-lg border border-[var(--nb-border)] hover:bg-[var(--nb-bg)] transition-colors"
          >
            <ChevronLeft size={15} className="text-[var(--nb-text-2)]" />
          </button>
          <span className="text-sm font-semibold text-[var(--nb-text)]">{monthLabel}</span>
          <button
            onClick={nextMonth}
            className="size-8 flex items-center justify-center rounded-lg border border-[var(--nb-border)] hover:bg-[var(--nb-bg)] transition-colors"
          >
            <ChevronRight size={15} className="text-[var(--nb-text-2)]" />
          </button>
        </div>
        <MonthCalendar blocks={blocks} year={viewYear} month={viewMonth} />
      </div>

      {/* Block list */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--nb-text)] mb-3">
          All blocks
          {blocks.length > 0 && (
            <span className="ml-2 text-xs font-normal text-[var(--nb-text-2)]">
              ({blocks.length})
            </span>
          )}
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-[var(--nb-text-2)]" />
          </div>
        ) : blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-2xl border-2 border-dashed border-[var(--nb-border)] text-center">
            <div className="size-10 rounded-xl bg-[var(--nb-card)] flex items-center justify-center mb-3">
              <Calendar size={18} className="text-[var(--nb-text-2)]" />
            </div>
            <p className="text-sm font-medium text-[var(--nb-text)]">No availability blocks yet</p>
            <p className="text-xs text-[var(--nb-text-2)] mt-1">
              Add blocks to control when clients can book
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {blocks.map((block) => {
              const isBlocked = block.block_type === "blocked";
              const startFmt = new Date(block.start_date + "T00:00:00").toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              });
              const endFmt = new Date(block.end_date + "T00:00:00").toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
              });
              const isSameDay = block.start_date === block.end_date;

              return (
                <div
                  key={block.id}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                    isBlocked
                      ? "border-red-200 bg-red-50"
                      : "border-emerald-200 bg-emerald-50"
                  }`}
                >
                  <div
                    className={`size-2.5 rounded-full shrink-0 mt-1.5 ${
                      isBlocked ? "bg-red-400" : "bg-emerald-400"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${isBlocked ? "text-red-800" : "text-emerald-800"}`}>
                      {block.label ?? (isBlocked ? "Blocked" : "Available")}
                    </p>
                    <p className={`text-xs mt-0.5 ${isBlocked ? "text-red-600" : "text-emerald-600"}`}>
                      {isSameDay ? startFmt : `${startFmt} — ${endFmt}`}
                    </p>
                    {block.notes && (
                      <p className={`text-xs mt-1 ${isBlocked ? "text-red-500" : "text-emerald-500"}`}>
                        {block.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditingBlock(block); setModalOpen(true); }}
                      className={`size-7 flex items-center justify-center rounded-lg transition-colors ${
                        isBlocked
                          ? "text-red-400 hover:text-red-600 hover:bg-red-100"
                          : "text-emerald-400 hover:text-emerald-600 hover:bg-emerald-100"
                      }`}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(block.id)}
                      disabled={deleting === block.id}
                      className={`size-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                        isBlocked
                          ? "text-red-400 hover:text-red-600 hover:bg-red-100"
                          : "text-emerald-400 hover:text-emerald-600 hover:bg-emerald-100"
                      }`}
                    >
                      {deleting === block.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddBlockModal
        open={modalOpen}
        editingBlock={editingBlock}
        onClose={() => { setModalOpen(false); setEditingBlock(null); }}
        onSaved={(block) => {
          setBlocks((prev) => {
            const without = prev.filter((b) => b.id !== block.id);
            return [...without, block].sort((a, b) => a.start_date.localeCompare(b.start_date));
          });
          setModalOpen(false);
          setEditingBlock(null);
        }}
      />
    </div>
  );
}
