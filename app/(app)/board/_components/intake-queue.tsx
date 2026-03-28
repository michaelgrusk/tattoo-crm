"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, X, Loader2 } from "lucide-react";
import type { TattooRequest } from "../page";
import { formatDistanceToNow } from "@/lib/date-utils";
import { RequestDetailModal } from "./request-detail-modal";
import { useCurrency } from "@/components/currency-provider";
import { supabase, getUserId } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const COLUMNS: {
  status: TattooRequest["status"];
  label: string;
  dotColor: string;
}[] = [
  { status: "new request", label: "New Request", dotColor: "bg-sky-400" },
  { status: "quote sent", label: "Quote Sent", dotColor: "bg-amber-400" },
  { status: "deposit paid", label: "Deposit Paid", dotColor: "bg-emerald-400" },
];

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

  // Fallback: if no structured fields found and all on one line, try inline parsing.
  // Handles legacy data like "Kitsune tattoo Placement: Right arm Size: 50cm Phone: 555-0100"
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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="font-medium text-[var(--nb-text-2)] w-[68px] shrink-0 pt-px">{label}</span>
      <span className="text-[var(--nb-text)] min-w-0 break-words">{value}</span>
    </div>
  );
}

function RequestCard({
  request,
  onClick,
}: {
  request: TattooRequest;
  onClick: () => void;
}) {
  const { format } = useCurrency();
  const parsed = parseDescription(request.description);

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] p-4 shadow-sm hover:shadow-md hover:border-[#7C3AED]/40 transition-all"
    >
      {/* Header: name + style badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-[var(--nb-text)] truncate">
            {request.client_name}
          </p>
          <p className="text-xs text-[var(--nb-text-2)] mt-0.5 truncate">{request.client_email}</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-[var(--nb-active-bg)] px-2 py-0.5 text-xs font-medium text-[#7C3AED] shrink-0">
          {request.style}
        </span>
      </div>

      {/* Labeled detail rows */}
      <div className="space-y-1.5 bg-[var(--nb-card)] rounded-lg border border-[var(--nb-card)] px-3 py-2.5">
        {parsed.tattooDescription && (
          <FieldRow label="Description" value={parsed.tattooDescription} />
        )}
        {parsed.placement && (
          <FieldRow label="Placement" value={parsed.placement} />
        )}
        {parsed.size && (
          <FieldRow label="Size" value={parsed.size} />
        )}
        {parsed.preferredDate && (
          <FieldRow label="Pref. date" value={formatPreferredDate(parsed.preferredDate)} />
        )}
        {parsed.phone && (
          <FieldRow label="Phone" value={parsed.phone} />
        )}
        {!parsed.tattooDescription && !parsed.placement && !parsed.size && !parsed.preferredDate && !parsed.phone && (
          <p className="text-xs text-[var(--nb-text-2)] italic">No details provided</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[var(--nb-card)]">
        <span className="text-xs text-[var(--nb-text-2)]">
          {formatDistanceToNow(request.created_at)}
        </span>
        {request.quote_amount != null && (
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
            {format(request.quote_amount)} quoted
          </span>
        )}
        <span className="text-xs text-[#7C3AED] font-medium">View →</span>
      </div>
    </button>
  );
}

// ── New Request Modal ─────────────────────────────────────────────────────────

const STYLES = ["Blackwork", "Japanese", "Fine line", "Watercolor", "Geometric", "Traditional", "Realism", "Neo-traditional", "Tribal", "Portrait"];

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

    // Pack structured fields into description (matches public intake format)
    const parts = [description.trim()];
    if (placement.trim()) parts.push(`Placement: ${placement.trim()}`);
    if (size.trim()) parts.push(`Size: ${size.trim()}`);
    if (preferredDate) parts.push(`Preferred date: ${preferredDate}`);
    if (phone.trim()) parts.push(`Phone: ${phone.trim()}`);

    const { error: dbError } = await supabase.from("tattoo_requests").insert({
      user_id: userId,
      client_name: name.trim(),
      client_email: email.trim() || null,
      style: Array.from(selectedStyles).join(", "),
      description: parts.join("\n"),
      status,
      artist_id: artistId ? Number(artistId) : null,
    });
    setSubmitting(false);
    if (dbError) { setError(dbError.message); return; }
    // Signal sidebar to refresh board badge
    window.dispatchEvent(new CustomEvent("nb:board-badge"));
    handleOpenChange(false);
    onSuccess();
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
          {/* Client info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs font-medium text-[var(--nb-text)]">Client name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text)]">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="client@example.com" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text)]">Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-0000" className={inputCls} />
            </div>
          </div>

          {/* Style multi-select */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--nb-text)]">
              Style * <span className="text-[var(--nb-text-2)] font-normal">(select all that apply)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => {
                const on = selectedStyles.has(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStyle(s)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      on
                        ? "bg-[#7C3AED] text-white border-[#7C3AED]"
                        : "bg-[var(--nb-card)] text-[var(--nb-text-2)] border-[var(--nb-border)] hover:border-[#7C3AED]/50 hover:text-[#7C3AED]"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--nb-text)]">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className={inputCls}>
              <option value="new request">New Request</option>
              <option value="quote sent">Quote Sent</option>
              <option value="deposit paid">Deposit Paid</option>
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--nb-text)]">Description *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the tattoo request…"
              rows={3}
              className="w-full rounded-lg border border-[var(--nb-border)] bg-[var(--nb-card)] px-3 py-2 text-sm text-[var(--nb-text)] outline-none placeholder:text-[var(--nb-text-2)] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors resize-none"
            />
          </div>

          {/* Placement + size */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text)]">Placement</label>
              <input type="text" value={placement} onChange={e => setPlacement(e.target.value)} placeholder="e.g. Left forearm" className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text)]">Size / dimensions</label>
              <input type="text" value={size} onChange={e => setSize(e.target.value)} placeholder="e.g. 10x8 cm" className={inputCls} />
            </div>
          </div>

          {/* Preferred date + artist */}
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

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
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

export function IntakeQueue({ requests }: { requests: TattooRequest[] }) {
  const router = useRouter();
  const [selectedRequest, setSelectedRequest] = useState<TattooRequest | null>(null);
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const totalActive = requests.filter(
    (r) => r.status !== "declined"
  ).length;

  return (
    <section>
      <div className="flex items-center gap-2.5 mb-4">
        <h2 className="text-base font-semibold text-[var(--nb-text)]">Intake Queue</h2>
        <span className="text-xs font-medium text-[var(--nb-text-2)] bg-[var(--nb-border)] rounded-full px-2.5 py-0.5">
          {totalActive}
        </span>
        <div className="ml-auto">
          <Button
            size="sm"
            onClick={() => setNewRequestOpen(true)}
            className="gap-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white h-8 text-xs"
          >
            <Plus size={13} />
            New Request
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {COLUMNS.map(({ status, label, dotColor }) => {
          const cards = requests.filter((r) => r.status === status);
          return (
            <div key={status}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`size-2 rounded-full ${dotColor}`} />
                <span className="text-sm font-medium text-[var(--nb-text)]">
                  {label}
                </span>
                <span className="ml-auto text-xs font-medium text-[var(--nb-text-2)] bg-[var(--nb-border)] rounded-full px-2 py-0.5">
                  {cards.length}
                </span>
              </div>
              <div className="space-y-3">
                {cards.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--nb-border)] p-6 text-center text-sm text-[var(--nb-text-2)]">
                    No requests
                  </div>
                ) : (
                  cards.map((req) => (
                    <RequestCard
                      key={req.id}
                      request={req}
                      onClick={() => setSelectedRequest(req)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <RequestDetailModal
        request={selectedRequest}
        open={selectedRequest !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedRequest(null);
        }}
        onSuccess={handleSuccess}
      />

      <NewRequestModal
        open={newRequestOpen}
        onOpenChange={setNewRequestOpen}
        onSuccess={() => {
          router.refresh();
          fireToast("Request added!");
        }}
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
