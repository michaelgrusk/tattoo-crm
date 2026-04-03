"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, X, ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase/client";

export type FlashPiece = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  size_guidance: string | null;
  placement_notes: string | null;
  status: "available" | "pending" | "claimed" | "archived";
  repeatable: boolean;
  image_url: string | null;
  sort_order: number;
  created_at: string;
};

const inputCls =
  "w-full rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-2.5 text-sm text-[var(--nb-text)] outline-none placeholder:text-[var(--nb-text-2)] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors";

const labelCls = "block text-sm font-medium text-[var(--nb-text)] mb-1.5";

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "pending",   label: "Pending" },
  { value: "claimed",   label: "Claimed" },
  { value: "archived",  label: "Archived" },
];

export function FlashPieceModal({
  open,
  piece,
  userId,
  sortOrder,
  onClose,
  onSaved,
}: {
  open: boolean;
  piece: FlashPiece | null;
  userId: string;
  sortOrder: number;
  onClose: () => void;
  onSaved: (piece: FlashPiece) => void;
}) {
  const isEdit = !!piece;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [sizeGuidance, setSizeGuidance] = useState("");
  const [placementNotes, setPlacementNotes] = useState("");
  const [status, setStatus] = useState<FlashPiece["status"]>("available");
  const [repeatable, setRepeatable] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset form whenever modal opens with a new piece
  useEffect(() => {
    if (open) {
      setTitle(piece?.title ?? "");
      setDescription(piece?.description ?? "");
      setPrice(piece?.price != null ? String(piece.price) : "");
      setSizeGuidance(piece?.size_guidance ?? "");
      setPlacementNotes(piece?.placement_notes ?? "");
      setStatus(piece?.status ?? "available");
      setRepeatable(piece?.repeatable ?? false);
      setImageUrl(piece?.image_url ?? null);
      setError(null);
    }
  }, [open, piece]);

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("flash-images")
      .upload(path, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      setError(uploadError.message);
      setImageUploading(false);
      return;
    }

    const { data } = supabase.storage.from("flash-images").getPublicUrl(path);
    setImageUrl(data.publicUrl);
    setImageUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSave() {
    if (!title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError(null);

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      price: price ? parseFloat(price) : null,
      size_guidance: sizeGuidance.trim() || null,
      placement_notes: placementNotes.trim() || null,
      status,
      repeatable,
      image_url: imageUrl,
    };

    let resultData: FlashPiece | null = null;
    let resultError: { message: string } | null = null;

    if (isEdit && piece) {
      const { data, error: dbError } = await supabase
        .from("flash_pieces")
        .update(payload)
        .eq("id", piece.id)
        .select()
        .single();
      resultData = data as FlashPiece | null;
      resultError = dbError;
    } else {
      const { data, error: dbError } = await supabase
        .from("flash_pieces")
        .insert({ ...payload, user_id: userId, sort_order: sortOrder })
        .select()
        .single();
      resultData = data as FlashPiece | null;
      resultError = dbError;
    }

    setSaving(false);
    if (resultError) { setError(resultError.message); return; }
    if (resultData) onSaved(resultData);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Flash Piece" : "Add Flash Piece"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Image upload */}
          <div>
            <label className={labelCls}>Image</label>
            {imageUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-[var(--nb-border)] bg-[var(--nb-bg)] h-40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Flash piece" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="absolute top-2 right-2 size-7 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={imageUploading}
                className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--nb-border)] bg-[var(--nb-card)] hover:bg-[var(--nb-bg)] hover:border-[#7C3AED]/40 py-6 text-sm text-[var(--nb-text-2)] transition-colors disabled:opacity-60"
              >
                {imageUploading ? (
                  <Loader2 size={20} className="animate-spin text-[#7C3AED]" />
                ) : (
                  <>
                    <ImageIcon size={20} className="text-[var(--nb-text-2)]" />
                    <span className="text-xs">Click to upload image</span>
                  </>
                )}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>
              Title <span className="text-[#7C3AED]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Koi Fish"
              className={inputCls}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description of this design"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Price + Size */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Price</label>
              <input
                type="number"
                min={0}
                step={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 300"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Size guidance</label>
              <input
                type="text"
                value={sizeGuidance}
                onChange={(e) => setSizeGuidance(e.target.value)}
                placeholder='e.g. "palm-sized"'
                className={inputCls}
              />
            </div>
          </div>

          {/* Placement notes */}
          <div>
            <label className={labelCls}>Placement notes</label>
            <input
              type="text"
              value={placementNotes}
              onChange={(e) => setPlacementNotes(e.target.value)}
              placeholder="e.g. Works well on forearm or calf"
              className={inputCls}
            />
          </div>

          {/* Status + Repeatable */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className={labelCls}>Status</label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as FlashPiece["status"])}
                  className={`${inputCls} appearance-none pr-8`}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--nb-text-2)]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer pb-2.5">
              <div className="relative flex items-center justify-center shrink-0">
                <input
                  type="checkbox"
                  checked={repeatable}
                  onChange={(e) => setRepeatable(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="size-5 rounded-md border-2 border-[var(--nb-border)] bg-[var(--nb-card)] peer-checked:bg-[#7C3AED] peer-checked:border-[#7C3AED] transition-colors flex items-center justify-center">
                  {repeatable && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-[var(--nb-text)]">Repeatable design</span>
            </label>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
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
              disabled={saving || imageUploading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              {isEdit ? "Save Changes" : "Add Flash Piece"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
