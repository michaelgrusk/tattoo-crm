"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Upload, X, ImageIcon } from "lucide-react";
import { supabase, getUserId } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

// ─── Constants ────────────────────────────────────────────────────────────────

export const COMPLETED_TATTOO_STYLES = [
  "Blackwork", "Japanese", "Fine line", "Watercolor", "Geometric",
  "Traditional", "Realism", "Neo-traditional", "Tribal", "Portrait", "Other",
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Artist = { id: number; name: string };

export type CompletedTattoo = {
  id: number;
  created_at: string;
  client_id: number;
  tattoo_request_id: number | null;
  artist_id: number | null;
  photo_url: string | null;
  style: string | null;
  placement: string | null;
  notes: string | null;
  session_date: string | null;
  is_walk_in: boolean;
  artists: { name: string } | null;
  tattoo_requests: { description: string; style: string } | null;
};

export type TattooRequestOption = {
  id: string;
  description: string;
  style: string;
};

// ─── Upload helper ────────────────────────────────────────────────────────────

async function uploadCompletedPhoto(
  file: File,
  clientId: string
): Promise<{ url: string; error: null } | { url: null; error: string }> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${clientId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from("completed-tattoos")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) return { url: null, error: error.message };
  const { data } = supabase.storage.from("completed-tattoos").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls =
  "w-full h-9 rounded-lg border border-[var(--nb-border)] bg-[var(--nb-bg)] px-3 text-sm text-[var(--nb-text)] outline-none placeholder:text-[var(--nb-text-2)] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors";

// ─── Modal ────────────────────────────────────────────────────────────────────

export function CompletedTattooModal({
  open,
  onOpenChange,
  clientId,
  tattoo,
  requests,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  tattoo: CompletedTattoo | null;
  requests: TattooRequestOption[];
  onSaved: (saved: CompletedTattoo) => void;
}) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState(todayStr());
  const [style, setStyle] = useState("");
  const [placement, setPlacement] = useState("");
  const [notes, setNotes] = useState("");
  const [artistId, setArtistId] = useState("");
  const [requestId, setRequestId] = useState("walkin");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Fetch artists when modal opens
  useEffect(() => {
    if (!open) return;
    getUserId().then((uid) => {
      if (!uid) return;
      supabase
        .from("artists")
        .select("id, name")
        .eq("user_id", uid)
        .eq("is_active", true)
        .order("name")
        .then(({ data }) => setArtists((data as Artist[]) ?? []));
    });
  }, [open]);

  // Sync form state when opening / switching between add and edit
  useEffect(() => {
    if (!open) return;
    if (tattoo) {
      setSessionDate(tattoo.session_date ?? todayStr());
      setStyle(tattoo.style ?? "");
      setPlacement(tattoo.placement ?? "");
      setNotes(tattoo.notes ?? "");
      setArtistId(tattoo.artist_id ? String(tattoo.artist_id) : "");
      setRequestId(tattoo.tattoo_request_id ? String(tattoo.tattoo_request_id) : "walkin");
      setPhotoPreview(tattoo.photo_url ?? null);
    } else {
      setSessionDate(todayStr());
      setStyle("");
      setPlacement("");
      setNotes("");
      setArtistId("");
      setRequestId("walkin");
      setPhotoPreview(null);
    }
    setPhotoFile(null);
    setError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tattoo?.id]);

  function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    e.target.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const userId = await getUserId();
    if (!userId) { setError("Not authenticated"); setSubmitting(false); return; }

    // Upload new photo if a file was selected
    let photoUrl: string | null = tattoo?.photo_url ?? null;
    if (photoFile) {
      const result = await uploadCompletedPhoto(photoFile, clientId);
      if (result.error) {
        setError(`Photo upload failed: ${result.error}`);
        setSubmitting(false);
        return;
      }
      photoUrl = result.url;
    }

    const isWalkIn = requestId === "walkin";
    const payload = {
      user_id: userId,
      client_id: clientId,
      tattoo_request_id: isWalkIn ? null : Number(requestId),
      artist_id: artistId ? Number(artistId) : null,
      photo_url: photoUrl,
      style: style.trim() || null,
      placement: placement.trim() || null,
      notes: notes.trim() || null,
      session_date: sessionDate || null,
      is_walk_in: isWalkIn,
    };

    let result;
    if (tattoo) {
      result = await supabase
        .from("completed_tattoos")
        .update(payload)
        .eq("id", tattoo.id)
        .select("*, artists(name), tattoo_requests(description, style)")
        .single();
    } else {
      result = await supabase
        .from("completed_tattoos")
        .insert(payload)
        .select("*, artists(name), tattoo_requests(description, style)")
        .single();
    }

    setSubmitting(false);
    if (result.error) { setError(result.error.message); return; }
    onSaved(result.data as CompletedTattoo);
    onOpenChange(false);
  }

  const isEdit = !!tattoo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-[var(--nb-card)] border border-[var(--nb-border)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[var(--nb-text)]">
            {isEdit ? "Edit Completed Tattoo" : "Log Completed Tattoo"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? "Edit this completed tattoo record" : "Log a completed tattoo for this client"}
          </DialogDescription>
        </DialogHeader>

        <form id="completed-tattoo-form" onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Photo upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--nb-text)]">Photo</label>
            {photoPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-[var(--nb-border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Tattoo preview"
                  className="w-full max-h-52 object-cover"
                />
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-black/50 text-white hover:bg-black/70 transition-colors"
                  >
                    <Upload size={11} />
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(tattoo?.photo_url ?? null); }}
                    className="size-7 flex items-center justify-center rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center gap-2 py-7 rounded-xl border border-dashed border-[var(--nb-border)] bg-[var(--nb-bg)] hover:border-[#7C3AED] hover:bg-[var(--nb-active-bg)] transition-colors text-[var(--nb-text-2)] hover:text-[#7C3AED]"
              >
                <ImageIcon size={20} />
                <span className="text-xs font-medium">Upload photo</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} />
          </div>

          {/* Session date + Style */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text)]">Session date</label>
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text)]">Style</label>
              <select value={style} onChange={(e) => setStyle(e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                {COMPLETED_TATTOO_STYLES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Placement */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--nb-text)]">Placement</label>
            <input
              type="text"
              value={placement}
              onChange={(e) => setPlacement(e.target.value)}
              placeholder="e.g. Left forearm, right shoulder…"
              className={inputCls}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--nb-text)]">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Client wants to add wings in a future session…"
              rows={3}
              className="w-full rounded-lg border border-[var(--nb-border)] bg-[var(--nb-bg)] px-3 py-2 text-sm text-[var(--nb-text)] outline-none placeholder:text-[var(--nb-text-2)] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors resize-none"
            />
          </div>

          {/* Artist */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--nb-text)]">Artist</label>
            <select value={artistId} onChange={(e) => setArtistId(e.target.value)} className={inputCls}>
              <option value="">No artist assigned</option>
              {artists.map((a) => (
                <option key={a.id} value={String(a.id)}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Associated request */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--nb-text)]">Associated Request</label>
            <select value={requestId} onChange={(e) => setRequestId(e.target.value)} className={inputCls}>
              <option value="walkin">Walk-in (no request)</option>
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.style}
                  {r.description ? ` — ${r.description.slice(0, 55)}${r.description.length > 55 ? "…" : ""}` : ""}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={submitting}>Cancel</Button>
          </DialogClose>
          <Button
            type="submit"
            form="completed-tattoo-form"
            disabled={submitting}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            {submitting ? "Saving…" : isEdit ? "Save Changes" : "Log Tattoo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
