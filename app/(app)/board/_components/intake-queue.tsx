"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Loader2, CalendarCheck } from "lucide-react";
import type { TattooRequest, Appointment } from "../page";
import { formatDistanceToNow } from "@/lib/date-utils";
import { RequestDetailModal } from "./request-detail-modal";
import { useCurrency } from "@/components/currency-provider";
import { supabase, getUserId } from "@/lib/supabase/client";
import { analyzeBrief } from "@/lib/ai/analyze-brief";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ── Column config ─────────────────────────────────────────────────────────────

const COLUMNS: {
  status: TattooRequest["status"];
  label: string;
  dotColor: string;
}[] = [
  { status: "new request",  label: "New Request",  dotColor: "bg-sky-400" },
  { status: "quote sent",   label: "Quote Sent",   dotColor: "bg-amber-400" },
  { status: "deposit paid", label: "Deposit Paid", dotColor: "bg-emerald-400" },
  { status: "booked",       label: "Booked",       dotColor: "bg-violet-400" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDescription(raw: string) {
  const FIELD_RE = /^(Placement|Size|Preferred date|Phone):\s*(.+)$/;
  const lines = raw.split("\n");
  const structured: Record<string, string> = {};
  const descLines: string[] = [];

  for (const line of lines) {
    const m = line.match(FIELD_RE);
    if (m) structured[m[1]] = m[2].trim();
    else if (line.trim()) descLines.push(line);
  }

  if (Object.keys(structured).length === 0 && lines.length === 1) {
    const parts = raw.split(/\s+(?=(?:Placement|Size|Preferred date|Phone):\s*)/);
    if (parts.length > 1) {
      descLines.length = 0;
      for (const part of parts) {
        const m = part.trim().match(FIELD_RE);
        if (m) structured[m[1]] = m[2].trim();
        else if (part.trim()) descLines.push(part.trim());
      }
    }
  }

  return {
    tattooDescription: descLines.join("\n").trim(),
    placement: structured["Placement"] ?? "",
    size: structured["Size"] ?? "",
    preferredDate: structured["Preferred date"] ?? "",
    phone: structured["Phone"] ?? "",
  };
}

function formatPreferredDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatApptDate(date: string, time: string) {
  const d = new Date(`${date}T${time}`);
  return {
    date: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="font-medium text-[var(--nb-text-2)] w-[68px] shrink-0 pt-px">{label}</span>
      <span className="text-[var(--nb-text)] min-w-0 break-words">{value}</span>
    </div>
  );
}

// ── Request Card (New Request / Quote Sent / Deposit Paid) ────────────────────

function RequestCard({ request, onClick }: { request: TattooRequest; onClick: () => void }) {
  const { format } = useCurrency();
  const parsed = parseDescription(request.description);

  const RATING_COLORS: Record<string, string> = {
    "Great fit":       "bg-emerald-50 text-emerald-700 border-emerald-200",
    "Good fit":        "bg-sky-50 text-sky-700 border-sky-200",
    "Needs more info": "bg-amber-50 text-amber-700 border-amber-200",
    "Low effort":      "bg-red-50 text-red-600 border-red-200",
  };

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] p-4 shadow-sm hover:shadow-md hover:border-[#7C3AED]/40 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-[var(--nb-text)] truncate">{request.client_name}</p>
          <p className="text-xs text-[var(--nb-text-2)] mt-0.5 truncate">{request.client_email}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {request.inquiry_type === "flash" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Flash
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-[var(--nb-active-bg)] px-2 py-0.5 text-xs font-medium text-[#7C3AED]">
            {request.style}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 bg-[var(--nb-card)] rounded-lg border border-[var(--nb-card)] px-3 py-2.5">
        {parsed.tattooDescription && <FieldRow label="Description" value={parsed.tattooDescription} />}
        {parsed.placement        && <FieldRow label="Placement"    value={parsed.placement} />}
        {parsed.size             && <FieldRow label="Size"         value={parsed.size} />}
        {parsed.preferredDate    && <FieldRow label="Pref. date"   value={formatPreferredDate(parsed.preferredDate)} />}
        {parsed.phone            && <FieldRow label="Phone"        value={parsed.phone} />}
        {!parsed.tattooDescription && !parsed.placement && !parsed.size && !parsed.preferredDate && !parsed.phone && (
          <p className="text-xs text-[var(--nb-text-2)] italic">No details provided</p>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--nb-card)]">
        <span className="text-xs text-[var(--nb-text-2)]">{formatDistanceToNow(request.created_at)}</span>
        <div className="flex items-center gap-1.5">
          {request.ai_analysis && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${RATING_COLORS[request.ai_analysis.overall_rating] ?? ""}`}>
              {request.ai_analysis.overall_rating}
            </span>
          )}
          {request.quote_amount != null && (
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
              {format(request.quote_amount)} quoted
            </span>
          )}
        </div>
        <span className="text-xs text-[#7C3AED] font-medium">View →</span>
      </div>
    </button>
  );
}

// ── Booked Card ───────────────────────────────────────────────────────────────

function BookedCard({
  request,
  appointment,
  onComplete,
  confirming,
  completing,
}: {
  request: TattooRequest;
  appointment: Appointment | null;
  onComplete: () => void;
  confirming: boolean;
  completing: boolean;
}) {
  const apptFmt = appointment ? formatApptDate(appointment.date, appointment.time) : null;
  const artistName = appointment
    ? ((appointment.artists as { name: string } | null)?.name ?? null)
    : null;

  return (
    <div className="w-full bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-[var(--nb-text)] truncate">{request.client_name}</p>
          <p className="text-xs text-[var(--nb-text-2)] mt-0.5 truncate">{request.client_email}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="inline-flex items-center rounded-full bg-[var(--nb-active-bg)] px-2 py-0.5 text-xs font-medium text-[#7C3AED]">
            {request.style}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
            <CalendarCheck size={9} />
            Scheduled
          </span>
        </div>
      </div>

      {/* Appointment details */}
      <div className="space-y-1.5 bg-[var(--nb-bg)] rounded-lg border border-[var(--nb-border)] px-3 py-2.5 mb-3">
        {apptFmt ? (
          <>
            <FieldRow label="Date"    value={apptFmt.date} />
            <FieldRow label="Time"    value={apptFmt.time} />
            {appointment?.type && <FieldRow label="Type"  value={appointment.type} />}
            {artistName          && <FieldRow label="Artist" value={artistName} />}
          </>
        ) : (
          <p className="text-xs text-[var(--nb-text-2)] italic">No appointment linked</p>
        )}
      </div>

      {/* Mark complete */}
      <button
        type="button"
        onClick={onComplete}
        disabled={completing}
        className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
          confirming
            ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
            : "bg-[var(--nb-bg)] text-[var(--nb-text-2)] border-[var(--nb-border)] hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
        }`}
      >
        {completing
          ? <><Loader2 size={11} className="animate-spin" /> Completing…</>
          : confirming
            ? <><CheckCircle2 size={11} /> Confirm Complete?</>
            : "Mark Complete"
        }
      </button>
    </div>
  );
}

// ── New Request Modal ─────────────────────────────────────────────────────────

const STYLES = [
  "Blackwork", "Japanese", "Fine line", "Watercolor", "Geometric",
  "Traditional", "Realism", "Neo-traditional", "Tribal", "Portrait", "Anime",
];

type ArtistOption = { id: number; name: string };

function NewRequestModal({ open, onOpenChange, onSuccess }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set());
  const [description, setDescription] = useState("");
  const [placement, setPlacement] = useState("");
  const [size, setSize] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [artistId, setArtistId] = useState<string>("");
  const [status, setStatus] = useState<"new request" | "quote sent" | "deposit paid">("new request");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [artists, setArtists] = useState<ArtistOption[]>([]);

  useEffect(() => {
    if (!open) return;
    getUserId().then((uid) => {
      if (!uid) return;
      supabase.from("artists").select("id, name").eq("user_id", uid).eq("is_active", true).order("name")
        .then(({ data }) => setArtists((data as ArtistOption[]) ?? []));
    });
  }, [open]);

  function reset() {
    setName(""); setEmail(""); setPhone(""); setSelectedStyles(new Set()); setDescription("");
    setPlacement(""); setSize(""); setPreferredDate(""); setArtistId("");
    setStatus("new request"); setError(null);
  }

  function toggleStyle(s: string) {
    setSelectedStyles((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || selectedStyles.size === 0 || !description.trim()) {
      setError("Name, at least one style, and description are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const userId = await getUserId();
    if (!userId) { setError("Not authenticated"); setSubmitting(false); return; }

    const parts = [description.trim()];
    if (placement.trim()) parts.push(`Placement: ${placement.trim()}`);
    if (size.trim())      parts.push(`Size: ${size.trim()}`);
    if (preferredDate)    parts.push(`Preferred date: ${preferredDate}`);
    if (phone.trim())     parts.push(`Phone: ${phone.trim()}`);

    const { data: newReq, error: dbError } = await supabase.from("tattoo_requests").insert({
      user_id: userId,
      client_name: name.trim(),
      client_email: email.trim() || null,
      style: Array.from(selectedStyles).join(", "),
      description: parts.join("\n"),
      status,
      artist_id: artistId ? Number(artistId) : null,
    }).select("id").single();
    if (dbError) { setSubmitting(false); setError(dbError.message); return; }

    if (email.trim() && newReq?.id) {
      const { data: existing } = await supabase
        .from("clients").select("id")
        .eq("user_id", userId).eq("email", email.trim().toLowerCase()).maybeSingle();

      let clientId: string | null = existing?.id ?? null;
      if (!clientId) {
        const { data: newClient } = await supabase.from("clients").insert({
          user_id: userId, name: name.trim(), email: email.trim(),
          phone: phone.trim() || null, status: "new_lead",
        }).select("id").single();
        clientId = newClient?.id ?? null;
        if (clientId) window.dispatchEvent(new CustomEvent("nb:contacts-badge"));
      }
      if (clientId) {
        await supabase.from("tattoo_requests").update({ client_id: clientId }).eq("id", newReq.id);
      }
    }

    setSubmitting(false);
    window.dispatchEvent(new CustomEvent("nb:board-badge"));
    handleOpenChange(false);
    onSuccess();

    if (newReq?.id) {
      const analysis = analyzeBrief({
        client_name: name.trim(),
        description: parts.join("\n"),
        style: Array.from(selectedStyles).join(", "),
        placement: placement.trim() || null,
        size: size.trim() || null,
        preferred_date: preferredDate || null,
        has_reference_image: false,
        has_phone: !!phone.trim(),
        has_instagram: false,
        artists,
      });
      const now = new Date().toISOString();
      supabase.from("tattoo_requests")
        .update({ ai_analysis: analysis, ai_analyzed_at: now })
        .eq("id", newReq.id).then(() => {});
    }
  }

  const inputCls = "w-full h-9 rounded-lg border border-[var(--nb-border)] bg-[var(--nb-card)] px-3 text-sm text-[var(--nb-text)] outline-none placeholder:text-[var(--nb-text-2)] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Intake Request</DialogTitle>
          <DialogDescription className="sr-only">Add a new tattoo request manually</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-medium text-[var(--nb-text)]">Client name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className={inputCls} dir="auto" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text)]">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="client@example.com" className={inputCls} dir="auto" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text)]">Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" className={inputCls} dir="auto" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--nb-text)]">
              Style * <span className="text-[var(--nb-text-2)] font-normal">(select all that apply)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => {
                const on = selectedStyles.has(s);
                return (
                  <button key={s} type="button" onClick={() => toggleStyle(s)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      on ? "bg-[#7C3AED] text-white border-[#7C3AED]"
                         : "bg-[var(--nb-card)] text-[var(--nb-text-2)] border-[var(--nb-border)] hover:border-[#7C3AED]/50 hover:text-[#7C3AED]"
                    }`}
                  >{s}</button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--nb-text)]">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className={inputCls}>
              <option value="new request">New Request</option>
              <option value="quote sent">Quote Sent</option>
              <option value="deposit paid">Deposit Paid</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--nb-text)]">Description *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Describe the tattoo request…" rows={3} dir="auto"
              className="w-full rounded-lg border border-[var(--nb-border)] bg-[var(--nb-card)] px-3 py-2 text-sm text-[var(--nb-text)] outline-none placeholder:text-[var(--nb-text-2)] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text)]">Placement</label>
              <input type="text" value={placement} onChange={e => setPlacement(e.target.value)} placeholder="e.g. Left forearm" className={inputCls} dir="auto" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text)]">Size / dimensions</label>
              <input type="text" value={size} onChange={e => setSize(e.target.value)} placeholder="e.g. 10x8 cm" className={inputCls} dir="auto" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text)]">Preferred date</label>
              <input type="date" value={preferredDate} onChange={e => setPreferredDate(e.target.value)} className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text)]">Assign to artist</label>
              <select value={artistId} onChange={e => setArtistId(e.target.value)} className={inputCls}>
                <option value="">Unassigned</option>
                {artists.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5">
              {submitting && <Loader2 size={13} className="animate-spin" />}
              Add Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── IntakeQueue ───────────────────────────────────────────────────────────────

type StatusFilter = "active" | "completed" | "archived" | "all";
type DateFilter = "all" | "7d" | "30d";

export function IntakeQueue({
  requests,
  appointments,
}: {
  requests: TattooRequest[];
  appointments: Appointment[];
}) {
  const router = useRouter();
  const [selectedRequest, setSelectedRequest]   = useState<TattooRequest | null>(null);
  const [newRequestOpen, setNewRequestOpen]       = useState(false);
  const [toast, setToast]                         = useState<string | null>(null);
  const toastTimer                                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [statusFilter, setStatusFilter]           = useState<StatusFilter>("active");
  const [dateFilter, setDateFilter]               = useState<DateFilter>("all");
  const [confirmCompleteId, setConfirmCompleteId] = useState<string | null>(null);
  const [completingId, setCompletingId]           = useState<string | null>(null);

  // Build appointment lookup by client_id (first upcoming appointment per client)
  const apptByClientId = new Map<string, Appointment>();
  for (const a of appointments) {
    if (a.client_id && !apptByClientId.has(a.client_id)) {
      apptByClientId.set(a.client_id, a);
    }
  }

  function fireToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  function handleSuccess(message: string) {
    setSelectedRequest(null);
    router.refresh();
    fireToast(message);
  }

  async function handleMarkComplete(req: TattooRequest) {
    if (confirmCompleteId !== req.id) {
      setConfirmCompleteId(req.id);
      return;
    }
    setCompletingId(req.id);
    setConfirmCompleteId(null);

    await supabase.from("tattoo_requests").update({ status: "completed" }).eq("id", req.id);

    if (req.client_id) {
      const appt = apptByClientId.get(req.client_id);
      if (appt) {
        await supabase.from("appointments").update({ status: "completed" }).eq("id", appt.id);
      }
    }

    setCompletingId(null);
    router.refresh();
    fireToast("Session marked complete!");
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const now = Date.now();
  const dateFiltered = requests.filter((r) => {
    if (dateFilter === "all") return true;
    const cutoff = dateFilter === "7d" ? 7 : 30;
    return now - new Date(r.created_at).getTime() <= cutoff * 24 * 60 * 60 * 1000;
  });

  const activeStatuses = new Set(["new request", "quote sent", "deposit paid", "booked"]);

  const visible = dateFiltered.filter((r) => {
    if (statusFilter === "active")    return activeStatuses.has(r.status);
    if (statusFilter === "completed") return r.status === "completed";
    if (statusFilter === "archived")  return r.status === "archived";
    return true;
  });

  const archivedCount  = dateFiltered.filter((r) => r.status === "archived").length;
  const completedCount = dateFiltered.filter((r) => r.status === "completed").length;
  const totalActive    = dateFiltered.filter((r) => activeStatuses.has(r.status)).length;

  return (
    <section>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <h2 className="text-base font-semibold text-[var(--nb-text)]">Intake Queue</h2>
        <span className="text-xs font-medium text-[var(--nb-text-2)] bg-[var(--nb-border)] rounded-full px-2.5 py-0.5">
          {totalActive}
        </span>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setNewRequestOpen(true)}
            className="gap-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white h-8 text-xs">
            <Plus size={13} />
            New Request
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex rounded-lg border border-[var(--nb-border)] bg-[var(--nb-bg)] p-0.5 gap-0.5">
          {(["active", "completed", "archived", "all"] as const).map((f) => {
            const label =
              f === "active"    ? "Active" :
              f === "completed" ? `Completed${completedCount > 0 ? ` (${completedCount})` : ""}` :
              f === "archived"  ? `Archived${archivedCount   > 0 ? ` (${archivedCount})`   : ""}` :
              "All";
            return (
              <button key={f} type="button" onClick={() => setStatusFilter(f)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === f
                    ? "bg-[var(--nb-card)] text-[#7C3AED] shadow-sm border border-[var(--nb-border)]"
                    : "text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
                }`}>
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex rounded-lg border border-[var(--nb-border)] bg-[var(--nb-bg)] p-0.5 gap-0.5">
          {([["all", "All time"], ["30d", "Last 30d"], ["7d", "Last 7d"]] as const).map(([f, label]) => (
            <button key={f} type="button" onClick={() => setDateFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                dateFilter === f
                  ? "bg-[var(--nb-card)] text-[#7C3AED] shadow-sm border border-[var(--nb-border)]"
                  : "text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Completed / Archived — flat grid */}
      {(statusFilter === "completed" || statusFilter === "archived") && (
        <div>
          {visible.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--nb-border)] p-10 text-center text-sm text-[var(--nb-text-2)]">
              No {statusFilter} requests
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visible.map((req) => (
                <div key={req.id} className="relative">
                  <span className={`absolute top-2 right-2 z-10 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                    statusFilter === "completed"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}>
                    {statusFilter === "completed" ? "Completed" : "Archived"}
                  </span>
                  <RequestCard request={req} onClick={() => setSelectedRequest(req)} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active / All — 4 columns, horizontally scrollable on mobile */}
      {statusFilter !== "completed" && statusFilter !== "archived" && (
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
          <div className="grid grid-cols-4 gap-4 min-w-[800px] sm:min-w-0">
            {COLUMNS.map(({ status, label, dotColor }) => {
              const cards = visible.filter((r) => r.status === status);
              return (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`size-2 rounded-full shrink-0 ${dotColor}`} />
                    <span className="text-sm font-medium text-[var(--nb-text)] truncate">{label}</span>
                    <span className="ml-auto text-xs font-medium text-[var(--nb-text-2)] bg-[var(--nb-border)] rounded-full px-2 py-0.5 shrink-0">
                      {cards.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {cards.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[var(--nb-border)] p-5 text-center text-sm text-[var(--nb-text-2)]">
                        No requests
                      </div>
                    ) : status === "booked" ? (
                      cards.map((req) => (
                        <BookedCard
                          key={req.id}
                          request={req}
                          appointment={req.client_id ? (apptByClientId.get(req.client_id) ?? null) : null}
                          onComplete={() => handleMarkComplete(req)}
                          confirming={confirmCompleteId === req.id}
                          completing={completingId === req.id}
                        />
                      ))
                    ) : (
                      cards.map((req) => (
                        <RequestCard key={req.id} request={req} onClick={() => setSelectedRequest(req)} />
                      ))
                    )}
                    {/* Archived hint in first column */}
                    {statusFilter === "active" && status === "new request" && archivedCount > 0 && (
                      <button type="button" onClick={() => setStatusFilter("archived")}
                        className="w-full text-center text-xs text-[var(--nb-text-2)] hover:text-amber-600 py-1.5 transition-colors">
                        {archivedCount} archived — view →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <RequestDetailModal
        request={selectedRequest}
        open={selectedRequest !== null}
        onOpenChange={(open) => { if (!open) setSelectedRequest(null); }}
        onSuccess={handleSuccess}
      />

      <NewRequestModal
        open={newRequestOpen}
        onOpenChange={setNewRequestOpen}
        onSuccess={() => { router.refresh(); fireToast("Request added!"); }}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium bg-emerald-600 text-white animate-in slide-in-from-bottom-4 fade-in duration-200">
          <CheckCircle2 size={16} className="shrink-0" />
          {toast}
        </div>
      )}
    </section>
  );
}
