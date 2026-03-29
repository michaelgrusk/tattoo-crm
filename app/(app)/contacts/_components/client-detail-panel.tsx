"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mail,
  Phone,
  Calendar,
  Loader2,
  Upload,
  Plus,
  ImageIcon,
  X,
  Expand,
  CheckCircle2,
  AlertCircle,
  ScrollText,
  Eye,
  MessageCircle,
} from "lucide-react";
import { supabase, getUserId } from "@/lib/supabase/client";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { useRouter } from "next/navigation";
import { STATUS_CONFIG } from "./contacts-view";
import { useCurrency } from "@/components/currency-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { ClientListItem } from "../page";
import type { SignedWaiver, WaiverField, WaiverSection } from "../../waivers/types";
import { BookAppointmentDialog } from "../../calendar/_components/book-appointment-dialog";
import { NewInvoiceDialog } from "../../invoices/_components/new-invoice-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type TattooRequest = {
  id: string;
  description: string;
  style: string;
  status: string;
  created_at: string;
  reference_image_url: string | null;
  quote_amount: number | null;
};

type NextAppointment = {
  date: string;
  time: string;
  type: string;
  status: string;
  artist_name: string;
} | null;

type ClientAppt = {
  id: string;
  date: string;
  time: string;
  type: string;
  status: string;
  artist_name: string | null;
  artists: { name: string } | null;
};

type ArtistHistoryRow = {
  artist_id: number;
  name: string;
  avatar_url: string | null;
  sessions: number;
};

type WaMessage = {
  id: string;
  direction: "inbound" | "outbound";
  template_name: string | null;
  message_text: string | null;
  status: string;
  status_updated_at: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const REQUEST_STATUS_STYLES: Record<string, { text: string; bg: string }> = {
  "new request": { text: "text-sky-700", bg: "bg-sky-50" },
  "quote sent": { text: "text-amber-700", bg: "bg-amber-50" },
  "deposit paid": { text: "text-emerald-700", bg: "bg-emerald-50" },
  completed: { text: "text-violet-700", bg: "bg-violet-50" },
};

const STATUS_OPTIONS = [
  { value: "new request", label: "New Request" },
  { value: "quote sent", label: "Quote Sent" },
  { value: "deposit paid", label: "Deposit Paid" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusStyle(status: string) {
  return (
    REQUEST_STATUS_STYLES[status.toLowerCase()] ?? {
      text: "text-[var(--nb-text-2)]",
      bg: "bg-[var(--nb-border)]",
    }
  );
}

const TATTOO_STYLES = ["Traditional", "Neo-Traditional", "Realism", "Watercolor", "Blackwork", "Tribal", "Japanese", "Geometric", "Minimalist", "Illustrative", "Dotwork", "Surrealism", "Other"];

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
  return {
    tattooDescription: descLines.join("\n").trim(),
    placement: structured["Placement"] ?? "",
    size: structured["Size"] ?? "",
    preferredDate: structured["Preferred date"] ?? "",
    phone: structured["Phone"] ?? "",
  };
}

function formatDate(dateStr: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...opts,
  });
}

function formatAppointmentDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

type UploadResult = { url: string; error: null } | { url: null; error: string };

/** Upload a file to the tattoo-references bucket and return the public URL. */
async function uploadToStorage(
  file: File,
  clientId: string
): Promise<UploadResult> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${clientId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  console.log("[tattoo-references] Uploading:", path, `(${file.size} bytes)`);

  const { error: uploadError } = await supabase.storage
    .from("tattoo-references")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    console.error("[tattoo-references] Storage upload failed:", uploadError);
    return { url: null, error: uploadError.message };
  }

  const { data } = supabase.storage
    .from("tattoo-references")
    .getPublicUrl(path);

  console.log("[tattoo-references] Public URL:", data.publicUrl);
  return { url: data.publicUrl, error: null };
}

// ─── StatBox ──────────────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] px-3 py-3 md:px-5 md:py-4 overflow-hidden">
      <p className="text-[10px] md:text-xs font-medium text-[var(--nb-text-2)] uppercase tracking-wide mb-1 truncate">
        {label}
      </p>
      <p className="text-base md:text-xl font-semibold text-[var(--nb-text)] break-words leading-tight">{value}</p>
      {sub && <p className="text-[10px] md:text-xs text-[var(--nb-text-2)] mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 size-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X size={18} />
      </button>
      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Reference image"
        className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ─── Edit Tattoo Request Dialog ───────────────────────────────────────────────

function EditRequestDialog({
  open,
  onOpenChange,
  request,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  request: TattooRequest | null;
  onSaved: (updated: TattooRequest) => void;
}) {
  const parsed = request ? parseDescription(request.description) : null;

  const [style, setStyle] = useState("");
  const [status, setStatus] = useState("");
  const [description, setDescription] = useState("");
  const [placement, setPlacement] = useState("");
  const [size, setSize] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && request && parsed) {
      setStyle(request.style);
      setStatus(request.status);
      setDescription(parsed.tattooDescription);
      setPlacement(parsed.placement);
      setSize(parsed.size);
      setPreferredDate(parsed.preferredDate);
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, request?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!style.trim() || !description.trim()) {
      setError("Style and description are required.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const parts = [description.trim()];
    if (placement.trim()) parts.push(`Placement: ${placement.trim()}`);
    if (size.trim()) parts.push(`Size: ${size.trim()}`);
    if (preferredDate) parts.push(`Preferred date: ${preferredDate}`);

    const newDescription = parts.join("\n");

    const { error: dbErr } = await supabase
      .from("tattoo_requests")
      .update({ style: style.trim(), status, description: newDescription })
      .eq("id", request!.id);

    setSubmitting(false);
    if (dbErr) { setError(dbErr.message); return; }

    onSaved({ ...request!, style: style.trim(), status, description: newDescription });
    onOpenChange(false);
  }

  const inputCls = "w-full h-9 rounded-lg border border-[var(--nb-border)] bg-[var(--nb-card)] px-3 text-sm text-[var(--nb-text)] outline-none placeholder:text-[var(--nb-text-2)] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-[var(--nb-card)] border border-[var(--nb-border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--nb-text)]">Edit Tattoo Request</DialogTitle>
          <DialogDescription className="sr-only">Edit tattoo request details</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text)]">Style *</label>
              <select value={style} onChange={e => setStyle(e.target.value)} className={inputCls}>
                <option value="">Select style…</option>
                {TATTOO_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--nb-text)]">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--nb-text)]">Description *</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[var(--nb-border)] bg-[var(--nb-card)] px-3 py-2 text-sm text-[var(--nb-text)] outline-none placeholder:text-[var(--nb-text-2)] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors resize-none"
            />
          </div>
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
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--nb-text)]">Preferred date</label>
            <input type="date" value={preferredDate} onChange={e => setPreferredDate(e.target.value)} className={inputCls} />
          </div>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-[var(--nb-border)] text-[var(--nb-text-2)]">Cancel</Button>
            <Button type="submit" disabled={submitting} className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5">
              {submitting && <Loader2 size={13} className="animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Tattoo Request Dialog ────────────────────────────────────────────────

type RequestForm = {
  description: string;
  style: string;
  status: string;
};

const EMPTY_FORM: RequestForm = {
  description: "",
  style: "",
  status: "new request",
};

function AddRequestDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  clientEmail,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientName: string;
  clientEmail: string;
  onSuccess: (req: TattooRequest) => void;
}) {
  const [form, setForm] = useState<RequestForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<RequestForm>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setErrors({});
      setImageFile(null);
      setImagePreview(null);
      setServerError(null);
    }
  }, [open]);

  function setField(key: keyof RequestForm) {
    return (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      setForm((p) => ({ ...p, [key]: e.target.value }));
      if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }));
    };
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    e.target.value = "";
  }

  function validate() {
    const errs: Partial<RequestForm> = {};
    if (!form.description.trim()) errs.description = "Description is required";
    if (!form.style.trim()) errs.style = "Style is required";
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

    let imageUrl: string | null = null;
    if (imageFile) {
      const result = await uploadToStorage(imageFile, clientId);
      if (result.error) {
        setServerError(`Image upload failed: ${result.error}`);
        setSubmitting(false);
        return;
      }
      imageUrl = result.url;
    }

    const { data, error } = await supabase
      .from("tattoo_requests")
      .insert({
        user_id: userId,
        client_id: clientId,
        client_name: clientName,
        client_email: clientEmail,
        description: form.description.trim(),
        style: form.style.trim(),
        status: form.status,
        reference_image_url: imageUrl,
      })
      .select("id, description, style, status, created_at, reference_image_url, quote_amount")
      .single();

    setSubmitting(false);

    if (error) {
      setServerError(error.message);
      return;
    }

    onOpenChange(false);
    onSuccess(data as TattooRequest);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Tattoo Request</DialogTitle>
          <DialogDescription className="sr-only">Add a new tattoo request for this client</DialogDescription>
        </DialogHeader>

        <form
          id="add-request-form"
          onSubmit={handleSubmit}
          className="space-y-4 pt-1"
        >
          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="req-description">
              Description{" "}
              <span className="text-destructive" aria-hidden>
                *
              </span>
            </Label>
            <Textarea
              id="req-description"
              placeholder="Describe the tattoo concept, size, placement…"
              value={form.description}
              onChange={setField("description")}
              aria-invalid={!!errors.description}
              className="min-h-[80px] resize-none"
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description}</p>
            )}
          </div>

          {/* Style + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="req-style">
                Style{" "}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Input
                id="req-style"
                placeholder="e.g. Blackwork, Neo-trad"
                value={form.style}
                onChange={setField("style")}
                aria-invalid={!!errors.style}
              />
              {errors.style && (
                <p className="text-xs text-destructive">{errors.style}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="req-status">Status</Label>
              <select
                id="req-status"
                value={form.status}
                onChange={setField("status")}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 transition-colors"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reference image */}
          <div className="space-y-1.5">
            <Label>Reference Image</Label>
            {imagePreview ? (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-[var(--nb-border)] bg-[var(--nb-bg)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="absolute top-2 right-2 size-7 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--nb-border)] bg-[var(--nb-card)] hover:bg-[var(--nb-bg)] py-6 text-sm text-[var(--nb-text-2)] transition-colors"
              >
                <ImageIcon size={20} className="text-[var(--nb-text-2)]" />
                <span>Click to attach a reference image</span>
                <span className="text-xs">PNG, JPG, WEBP up to 10 MB</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImagePick}
            />
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
            form="add-request-form"
            disabled={submitting}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            {submitting ? "Saving…" : "Add Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Client Dialog ───────────────────────────────────────────────────────

type EditClientForm = {
  name: string;
  email: string;
  phone: string;
  notes: string;
  skin_notes: string;
};

function EditClientDialog({
  open,
  onOpenChange,
  client,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: ClientListItem;
  onSuccess: (updated: ClientListItem) => void;
}) {
  const [form, setForm] = useState<EditClientForm>({
    name: client.name,
    email: client.email,
    phone: client.phone ?? "",
    notes: client.notes ?? "",
    skin_notes: client.skin_notes ?? "",
  });
  const [errors, setErrors] = useState<Partial<EditClientForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Re-sync form when client prop changes (e.g. switching clients)
  useEffect(() => {
    if (open) {
      setForm({
        name: client.name,
        email: client.email,
        phone: client.phone ?? "",
        notes: client.notes ?? "",
        skin_notes: client.skin_notes ?? "",
      });
      setErrors({});
      setServerError(null);
    }
  }, [open, client.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function setField(key: keyof EditClientForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((p) => ({ ...p, [key]: e.target.value }));
      if (errors[key]) setErrors((p) => ({ ...p, [key]: undefined }));
    };
  }

  function validate() {
    const errs: Partial<EditClientForm> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError(null);

    const { error } = await supabase
      .from("clients")
      .update({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        skin_notes: form.skin_notes.trim() || null,
      })
      .eq("id", client.id);

    setSubmitting(false);

    if (error) {
      setServerError(error.message);
      return;
    }

    onOpenChange(false);
    onSuccess({
      ...client,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
      skin_notes: form.skin_notes.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
          <DialogDescription className="sr-only">Edit client details</DialogDescription>
        </DialogHeader>

        <form id="edit-client-form" onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ec-name">
                Full name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ec-name"
                value={form.name}
                onChange={setField("name")}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec-email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ec-email"
                type="email"
                value={form.email}
                onChange={setField("email")}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ec-phone">Phone</Label>
            <Input
              id="ec-phone"
              type="tel"
              value={form.phone}
              onChange={setField("phone")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ec-notes">General Notes</Label>
            <Textarea
              id="ec-notes"
              value={form.notes}
              onChange={setField("notes")}
              className="min-h-[72px] resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ec-skin">Skin Notes</Label>
            <Textarea
              id="ec-skin"
              value={form.skin_notes}
              onChange={setField("skin_notes")}
              placeholder="Skin type, sensitivities, healing notes…"
              className="min-h-[72px] resize-none"
            />
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
            form="edit-client-form"
            disabled={submitting}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            {submitting ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastState = { message: string; type: "success" | "error" } | null;

function Toast({ message, type }: NonNullable<ToastState>) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium animate-in slide-in-from-bottom-4 fade-in duration-200 ${
        type === "success"
          ? "bg-emerald-600 text-white"
          : "bg-red-600 text-white"
      }`}
    >
      {type === "success" ? (
        <CheckCircle2 size={16} className="shrink-0" />
      ) : (
        <AlertCircle size={16} className="shrink-0" />
      )}
      {message}
    </div>
  );
}

// ─── Waiver viewer dialog ─────────────────────────────────────────────────────

function formatWaiverDate(str: string) {
  return new Date(str).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function renderWaiverResponse(
  field: WaiverField,
  responses: Record<string, string | boolean>
) {
  const val = responses[field.id];
  if (field.type === "checkbox") return val ? "✓ Agreed" : "✗ Not agreed";
  if (field.type === "yesno") {
    if (val === true || val === "true" || val === "yes") {
      const followUp = field.followUpLabel
        ? responses[field.id + "_followup"]
        : undefined;
      return followUp ? `Yes — ${followUp}` : "Yes";
    }
    return val === false || val === "false" || val === "no" ? "No" : String(val ?? "—");
  }
  return String(val ?? "—");
}

function WaiverViewDialog({
  waiver,
  onClose,
}: {
  waiver: SignedWaiver;
  onClose: () => void;
}) {
  // We don't have the full template sections here, so render raw responses
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-[var(--nb-card)] rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--nb-border)] shrink-0">
          <div>
            <h3 className="text-base font-semibold text-[var(--nb-text)]">
              {waiver.waiver_templates?.name ?? "Signed Waiver"}
            </h3>
            <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
              Signed {formatWaiverDate(waiver.signed_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-[var(--nb-bg)] transition-colors text-[var(--nb-text-2)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {Object.entries(waiver.responses).map(([key, val]) => (
            <div key={key} className="text-sm">
              <p className="text-[var(--nb-text-2)] mb-0.5 capitalize">
                {key.replace(/_/g, " ")}
              </p>
              <p className="text-[var(--nb-text)] font-medium">{String(val)}</p>
            </div>
          ))}

          {waiver.signature_data && (
            <div className="pt-2 border-t border-[var(--nb-border)]">
              <p className="text-xs font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-2">
                Signature
              </p>
              {waiver.signature_type === "draw" || waiver.signature_type === "drawn" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={waiver.signature_data}
                  alt="Signature"
                  className="border border-[var(--nb-border)] rounded-lg bg-white max-h-20 object-contain"
                />
              ) : (
                <p
                  className="text-[var(--nb-text)] text-2xl"
                  style={{ fontFamily: "cursive" }}
                >
                  {waiver.signature_data}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ClientDetailPanel({
  client,
  onDeleted,
  onUpdated,
}: {
  client: ClientListItem;
  onDeleted: (id: string | number) => void;
  onUpdated: (updated: ClientListItem) => void;
}) {
  const router = useRouter();
  const { format } = useCurrency();
  const [requests, setRequests] = useState<TattooRequest[]>([]);
  const [nextAppt, setNextAppt] = useState<NextAppointment>(null);
  const [apptDialogOpen, setApptDialogOpen] = useState(false);
  const [clientAppts, setClientAppts] = useState<ClientAppt[]>([]);
  const [apptTab, setApptTab] = useState<"requests" | "appointments" | "messages">("requests");
  const [waMessages, setWaMessages] = useState<WaMessage[]>([]);
  const [aftercareSendingId, setAftercareSendingId] = useState<string | null>(null);
  const [aftercareResult, setAftercareResult] = useState<{ id: string; msg: string } | null>(null);
  const [quoteSendingId, setQuoteSendingId] = useState<string | null>(null);
  const [quoteResult, setQuoteResult] = useState<{ id: string; msg: string } | null>(null);
  const [reminderSendingId, setReminderSendingId] = useState<string | null>(null);
  const [reminderResult, setReminderResult] = useState<{ id: string; msg: string } | null>(null);
  const [apptBookOpen, setApptBookOpen] = useState(false);
  const [localStatus, setLocalStatus] = useState<string>(client.status ?? "");
  const [statusSaving, setStatusSaving] = useState(false);
  const [signedWaivers, setSignedWaivers] = useState<SignedWaiver[]>([]);
  const [selectedWaiver, setSelectedWaiver] = useState<SignedWaiver | null>(null);
  const [artistHistory, setArtistHistory] = useState<ArtistHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string, type: "success" | "error") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  async function handleStatusChange(newStatus: string) {
    setLocalStatus(newStatus);
    setStatusSaving(true);
    await supabase
      .from("clients")
      .update({ status: newStatus })
      .eq("id", String(client.id));
    setStatusSaving(false);
    onUpdated({ ...client, status: newStatus });
  }

  async function handleDeleteClient() {
    setDeleting(true);
    // Cascade delete associated records first
    await supabase.from("tattoo_requests").delete().eq("client_id", String(client.id));
    await supabase.from("appointments").delete().eq("client_id", String(client.id));
    await supabase.from("invoices").delete().eq("client_id", String(client.id));
    await supabase.from("whatsapp_messages").delete().eq("client_id", String(client.id));
    await supabase.from("signed_waivers").delete().eq("client_id", String(client.id));
    const { error } = await supabase.from("clients").delete().eq("id", String(client.id));
    setDeleting(false);
    setDeleteDialogOpen(false);
    if (error) {
      showToast(`Failed to delete client: ${error.message}`, "error");
      return;
    }
    onDeleted(client.id);
  }

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Tattoo request edit/delete
  const [editingRequest, setEditingRequest] = useState<TattooRequest | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSendQuoteWA(req: TattooRequest) {
    const phone = client.phone || parseDescription(req.description).phone;
    if (!phone) { setQuoteResult({ id: req.id, msg: "No phone number on file" }); return; }
    setQuoteSendingId(req.id);
    setQuoteResult(null);
    const res = await sendWhatsAppTemplate({
      phoneNumber: phone,
      templateName: "quote",
      variables: {
        client_name: client.name.split(" ")[0],
        studio_name: "your studio",
        style: req.style,
        amount: req.quote_amount != null ? `$${req.quote_amount.toLocaleString()}` : "TBD",
      },
      clientId: String(client.id),
      relatedType: "tattoo_request",
      relatedId: req.id,
    });
    setQuoteSendingId(null);
    setQuoteResult({ id: req.id, msg: res.success ? "Quote sent via WhatsApp!" : `WhatsApp error: ${res.error}` });
  }

  async function handleSendReminder(appt: ClientAppt) {
    if (!client.phone) { setReminderResult({ id: appt.id, msg: "No phone number on file" }); return; }
    setReminderSendingId(appt.id);
    setReminderResult(null);
    const [h, m] = appt.time.split(":").map(Number);
    const timeStr = `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
    const dateStr = new Date(appt.date + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric",
    });
    const res = await sendWhatsAppTemplate({
      phoneNumber: client.phone,
      templateName: "reminder",
      variables: { client_name: client.name.split(" ")[0], studio_name: "your studio", date: dateStr, time: timeStr },
      clientId: String(client.id),
      relatedType: "appointment",
      relatedId: appt.id,
    });
    setReminderSendingId(null);
    setReminderResult({ id: appt.id, msg: res.success ? "Reminder sent via WhatsApp!" : `WhatsApp error: ${res.error}` });
  }

  async function handleSendAftercare(apptId: string) {
    if (!client.phone) {
      setAftercareResult({ id: apptId, msg: "No phone number on file" });
      return;
    }
    setAftercareSendingId(apptId);
    setAftercareResult(null);
    const res = await sendWhatsAppTemplate({
      phoneNumber: client.phone,
      templateName: "aftercare",
      variables: { client_name: client.name.split(" ")[0] },
      clientId: String(client.id),
      relatedType: "appointment",
      relatedId: apptId,
    });
    setAftercareSendingId(null);
    setAftercareResult({
      id: apptId,
      msg: res.success ? "Aftercare sent via WhatsApp!" : `WhatsApp error: ${res.error}`,
    });
  }

  async function handleDeleteRequest(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setDeletingId(id);
    const { error } = await supabase.from("tattoo_requests").delete().eq("id", id);
    setDeletingId(null);
    setConfirmDeleteId(null);
    if (!error) {
      setRequests((prev) => prev.filter((r) => r.id !== id));
    }
  }

  // Dialog
  const [addRequestOpen, setAddRequestOpen] = useState(false);

  // Per-card image upload state
  const [uploadingCardIds, setUploadingCardIds] = useState<Set<string>>(
    new Set()
  );
  // Reference images section upload state
  const [uploadingNew, setUploadingNew] = useState(false);

  const newImageInputRef = useRef<HTMLInputElement>(null);
  const cardImageInputRefs = useRef<Record<string, HTMLInputElement | null>>(
    {}
  );

  // ── Fetch ──────────────────────────────────────────────────────────────────

  async function refreshRequests() {
    const { data } = await supabase
      .from("tattoo_requests")
      .select("id, description, style, status, created_at, reference_image_url, quote_amount")
      .eq("client_id", String(client.id))
      .order("created_at", { ascending: false });
    setRequests((data as TattooRequest[]) ?? []);
  }

  // Reset confirmation state when switching clients
  useEffect(() => {
    setDeleteDialogOpen(false);
    setDeleting(false);
  }, [client.id]);

  // Sync local status when client changes
  useEffect(() => {
    setLocalStatus(client.status ?? "");
  }, [client.id, client.status]);

  useEffect(() => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    Promise.all([
      supabase
        .from("tattoo_requests")
        .select(
          "id, description, style, status, created_at, reference_image_url"
        )
        .eq("client_id", String(client.id))
        .order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("date, time, type, status, artist_name")
        .eq("client_id", String(client.id))
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(1),
      supabase
        .from("signed_waivers")
        .select("*, waiver_templates(name)")
        .eq("client_id", String(client.id))
        .order("signed_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("artist_id, artists(id, name, avatar_url)")
        .eq("client_id", String(client.id))
        .not("artist_id", "is", null),
      supabase
        .from("appointments")
        .select("id, date, time, type, status, artist_name, artists(name)")
        .eq("client_id", String(client.id))
        .order("date", { ascending: false }),
      supabase
        .from("whatsapp_messages")
        .select("id, direction, template_name, message_text, status, status_updated_at")
        .eq("client_id", String(client.id))
        .order("status_updated_at", { ascending: false }),
    ]).then(([{ data: reqs }, { data: appts }, { data: waivers }, { data: artistAppts }, { data: apptRows }, { data: waMsgs }]) => {
      setRequests((reqs as TattooRequest[]) ?? []);
      setNextAppt((appts?.[0] as NextAppointment) ?? null);
      setSignedWaivers((waivers as unknown as SignedWaiver[]) ?? []);
      setClientAppts((apptRows as unknown as ClientAppt[]) ?? []);
      setWaMessages((waMsgs as WaMessage[]) ?? []);
      // Aggregate artist history
      const map: Record<number, ArtistHistoryRow> = {};
      for (const row of (artistAppts ?? []) as unknown as { artist_id: number; artists: { id: number; name: string; avatar_url: string | null } | null }[]) {
        if (!row.artist_id || !row.artists) continue;
        if (!map[row.artist_id]) {
          map[row.artist_id] = { artist_id: row.artist_id, name: row.artists.name, avatar_url: row.artists.avatar_url, sessions: 0 };
        }
        map[row.artist_id].sessions += 1;
      }
      setArtistHistory(Object.values(map).sort((a, b) => b.sessions - a.sessions));
      setLoading(false);
    });
  }, [client.id]);

  // ── Upload handlers ────────────────────────────────────────────────────────

  /** Upload image from the Reference Images section → creates a new request */
  async function handleNewReferenceUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingNew(true);

    const clientId = String(client.id);
    const uploadResult = await uploadToStorage(file, clientId);

    if (uploadResult.error) {
      showToast(`Upload failed: ${uploadResult.error}`, "error");
      setUploadingNew(false);
      return;
    }

    const userId = await getUserId();
    if (!userId) {
      showToast("Not authenticated", "error");
      setUploadingNew(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("tattoo_requests")
      .insert({
        user_id: userId,
        client_id: clientId,
        client_name: client.name,
        client_email: client.email,
        description: "",
        style: "Reference",
        status: "new request",
        reference_image_url: uploadResult.url,
      })
      .select("id, description, style, status, created_at, reference_image_url, quote_amount")
      .single();

    if (insertError) {
      console.error("[tattoo_requests] Insert failed:", insertError);
      showToast(`Could not save image record: ${insertError.message}`, "error");
      setUploadingNew(false);
      return;
    }

    setRequests((prev) => [data as TattooRequest, ...prev]);
    showToast("Reference image uploaded successfully!", "success");
    setUploadingNew(false);
  }

  /** Upload image for an existing request card that has no image yet */
  async function handleCardImageUpload(
    requestId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploadingCardIds((prev) => new Set([...prev, requestId]));

    const uploadResult = await uploadToStorage(file, String(client.id));

    if (uploadResult.error) {
      showToast(`Upload failed: ${uploadResult.error}`, "error");
      setUploadingCardIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
      return;
    }

    const { error: updateError } = await supabase
      .from("tattoo_requests")
      .update({ reference_image_url: uploadResult.url })
      .eq("id", requestId);

    if (updateError) {
      console.error("[tattoo_requests] Update failed:", updateError);
      showToast(`Could not save image: ${updateError.message}`, "error");
    } else {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? { ...r, reference_image_url: uploadResult.url }
            : r
        )
      );
      showToast("Reference image added!", "success");
    }

    setUploadingCardIds((prev) => {
      const next = new Set(prev);
      next.delete(requestId);
      return next;
    });
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const referenceImages = requests.filter((r) => r.reference_image_url);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="p-8 max-w-3xl">
        {/* Client header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-start gap-4">
            <div className="size-14 rounded-full bg-[var(--nb-active-bg)] flex items-center justify-center text-lg font-semibold text-[#7C3AED] shrink-0">
              {client.name
                .trim()
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[var(--nb-text)]">
                {client.name}
              </h2>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                <span className="flex items-center gap-1.5 text-sm text-[var(--nb-text-2)]">
                  <Mail size={13} className="text-[var(--nb-text-2)]" />
                  {client.email}
                </span>
                {client.phone && (
                  <span className="flex items-center gap-1.5 text-sm text-[var(--nb-text-2)]">
                    <Phone size={13} className="text-[var(--nb-text-2)]" />
                    {client.phone}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-sm text-[var(--nb-text-2)]">
                  <Calendar size={13} className="text-[var(--nb-text-2)]" />
                  Client since{" "}
                  {formatDate(client.created_at, {
                    year: "numeric",
                    month: "short",
                  })}
                </span>
              </div>

              {/* Status dropdown */}
              <div className="mt-3 flex items-center gap-2">
                <div className="relative">
                  {localStatus && STATUS_CONFIG[localStatus] && (
                    <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 size-2 rounded-full pointer-events-none ${STATUS_CONFIG[localStatus].dot}`} />
                  )}
                  <select
                    value={localStatus}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={statusSaving}
                    className={`appearance-none pl-6 pr-6 py-1 text-xs font-medium rounded-full border transition-colors outline-none cursor-pointer disabled:opacity-60 ${
                      localStatus && STATUS_CONFIG[localStatus]
                        ? `${STATUS_CONFIG[localStatus].bg} ${STATUS_CONFIG[localStatus].text} border-transparent`
                        : "bg-[var(--nb-bg)] text-[var(--nb-text-2)] border-[var(--nb-border)]"
                    }`}
                  >
                    <option value="">No status</option>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="currentColor" opacity="0.5">
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                  </svg>
                </div>
                {statusSaving && <Loader2 size={12} className="animate-spin text-[var(--nb-text-2)]" />}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Quick actions */}
            <button
              onClick={() => setApptBookOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--nb-border)] bg-[var(--nb-card)] text-[var(--nb-text-2)] hover:border-[#7C3AED] hover:text-[#7C3AED] transition-colors"
            >
              <Plus size={11} />
              Book
            </button>
            <button
              onClick={() => setInvoiceOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--nb-border)] bg-[var(--nb-card)] text-[var(--nb-text-2)] hover:border-[#7C3AED] hover:text-[#7C3AED] transition-colors"
            >
              <Plus size={11} />
              Invoice
            </button>
            <button
              onClick={() => setAddRequestOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-[var(--nb-border)] bg-[var(--nb-card)] text-[var(--nb-text-2)] hover:border-[#7C3AED] hover:text-[#7C3AED] transition-colors"
            >
              <Plus size={11} />
              Request
            </button>
            {/* Edit / Delete */}
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--nb-border)] bg-[var(--nb-card)] text-[#7C3AED] hover:bg-[var(--nb-bg)] transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--nb-border)] bg-[var(--nb-card)] text-[var(--nb-text-2)] hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Stat boxes */}
        <div className="grid grid-cols-3 gap-2 md:gap-4 mb-8 items-stretch">
          <StatBox
            label="Total Spent"
            value={format(client.totalSpent)}
          />
          <StatBox
            label="Sessions"
            value={String(client.sessions)}
            sub={client.sessions === 1 ? "appointment" : "appointments"}
          />
          {/* Next Appointment — clickable when an appointment exists */}
          {nextAppt ? (
            <button
              onClick={() => setApptDialogOpen(true)}
              className="flex flex-col text-left bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] px-3 py-3 md:px-5 md:py-4 overflow-hidden hover:border-[#7C3AED]/50 hover:shadow-sm transition-all group"
            >
              <p className="text-[10px] md:text-xs font-medium text-[var(--nb-text-2)] uppercase tracking-wide mb-1 truncate group-hover:text-[#7C3AED] transition-colors">
                Next Appointment
              </p>
              <p className="text-base md:text-xl font-semibold text-[var(--nb-text)] break-words leading-tight">
                {formatAppointmentDate(nextAppt.date)}
              </p>
              <p className="text-[10px] md:text-xs text-[var(--nb-text-2)] mt-0.5 truncate">
                {formatTime(nextAppt.time)} · {nextAppt.type}
              </p>
            </button>
          ) : (
            <StatBox
              label="Next Appointment"
              value={loading ? "—" : "None scheduled"}
            />
          )}
        </div>

        {/* Next Appointment detail dialog */}
        {nextAppt && (
          <Dialog open={apptDialogOpen} onOpenChange={setApptDialogOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Next Appointment</DialogTitle>
                <DialogDescription className="sr-only">Upcoming appointment details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-1">
                <div className="bg-[var(--nb-bg)] rounded-xl border border-[var(--nb-border)] px-4 py-4 space-y-3">
                  <div>
                    <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">Date</p>
                    <p className="text-sm font-medium text-[var(--nb-text)]">
                      {new Date(nextAppt.date + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "long", month: "long", day: "numeric", year: "numeric",
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">Time</p>
                    <p className="text-sm font-medium text-[var(--nb-text)]">{formatTime(nextAppt.time)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">Type</p>
                    <p className="text-sm font-medium text-[var(--nb-text)]">{nextAppt.type}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">Status</p>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      nextAppt.status === "confirmed"
                        ? "bg-emerald-50 text-emerald-700"
                        : nextAppt.status === "cancelled"
                        ? "bg-red-50 text-red-700"
                        : nextAppt.status === "completed"
                        ? "bg-sky-50 text-sky-700"
                        : "bg-amber-50 text-amber-700"
                    }`}>
                      <span className={`size-1.5 rounded-full ${
                        nextAppt.status === "confirmed"
                          ? "bg-emerald-400"
                          : nextAppt.status === "cancelled"
                          ? "bg-red-400"
                          : nextAppt.status === "completed"
                          ? "bg-sky-400"
                          : "bg-amber-400"
                      }`} />
                      {nextAppt.status.charAt(0).toUpperCase() + nextAppt.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
                <Button
                  onClick={() => { setApptDialogOpen(false); router.push("/calendar"); }}
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
                >
                  View on Calendar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--nb-text-2)] py-8">
            <Loader2 size={16} className="animate-spin" />
            Loading client details…
          </div>
        ) : (
          <>
            {/* ── Reference Images ─────────────────────────────────────── */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[var(--nb-text)]">
                  Reference Images
                  {referenceImages.length > 0 && (
                    <span className="ml-2 text-xs font-medium text-[var(--nb-text-2)]">
                      {referenceImages.length}
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => newImageInputRef.current?.click()}
                  disabled={uploadingNew}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#7C3AED] bg-[var(--nb-active-bg)] hover:bg-[var(--nb-border)] border border-[#C8DFE8] transition-colors disabled:opacity-50"
                >
                  {uploadingNew ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Upload size={12} />
                  )}
                  {uploadingNew ? "Uploading…" : "Upload Image"}
                </button>
                <input
                  ref={newImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleNewReferenceUpload}
                />
              </div>

              {referenceImages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--nb-border)] bg-[var(--nb-card)] p-6 flex flex-col items-center gap-2 text-center">
                  <ImageIcon size={24} className="text-[var(--nb-text-2)]" />
                  <p className="text-sm text-[var(--nb-text-2)]">No reference images yet</p>
                  <p className="text-xs text-[var(--nb-text-2)]">
                    Upload an image or add a tattoo request with a reference
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {referenceImages.map((req) => (
                    <button
                      key={req.id}
                      onClick={() =>
                        setLightboxUrl(req.reference_image_url!)
                      }
                      className="group relative aspect-square rounded-xl overflow-hidden border border-[var(--nb-border)] bg-[var(--nb-bg)] hover:border-[#7C3AED] transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={req.reference_image_url!}
                        alt={req.style || "Reference"}
                        className="w-full h-full object-cover"
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <Expand
                          size={18}
                          className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
                        />
                      </div>
                      {/* Style label */}
                      {req.style && (
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                          <p className="text-[10px] font-medium text-white truncate">
                            {req.style}
                          </p>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* ── Notes ────────────────────────────────────────────────── */}
            {(client.notes || client.skin_notes) && (
              <section className="mb-8">
                <h3 className="text-sm font-semibold text-[var(--nb-text)] mb-3">
                  Notes
                </h3>
                <div className="space-y-3">
                  {client.skin_notes && (
                    <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] px-5 py-4">
                      <p className="text-xs font-medium text-[var(--nb-text-2)] uppercase tracking-wide mb-1.5">
                        Skin Notes
                      </p>
                      <p className="text-sm text-[var(--nb-text)] leading-relaxed">
                        {client.skin_notes}
                      </p>
                    </div>
                  )}
                  {client.notes && (
                    <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] px-5 py-4">
                      <p className="text-xs font-medium text-[var(--nb-text-2)] uppercase tracking-wide mb-1.5">
                        General Notes
                      </p>
                      <p className="text-sm text-[var(--nb-text)] leading-relaxed">
                        {client.notes}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── Signed Waivers ───────────────────────────────────────── */}
            {signedWaivers.length > 0 && (
              <section className="mb-8">
                <h3 className="text-sm font-semibold text-[var(--nb-text)] mb-3 flex items-center gap-2">
                  <ScrollText size={14} className="text-[var(--nb-text-2)]" />
                  Waivers
                  <span className="text-xs font-medium text-[var(--nb-text-2)]">
                    {signedWaivers.length}
                  </span>
                </h3>
                <div className="space-y-2">
                  {signedWaivers.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[var(--nb-text)]">
                          {w.waiver_templates?.name ?? "Waiver"}
                        </p>
                        <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                          Signed {formatDate(w.signed_at)}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedWaiver(w)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--nb-text-2)] bg-[var(--nb-bg)] border border-[var(--nb-border)] hover:text-[var(--nb-text)] transition-colors"
                      >
                        <Eye size={12} />
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Artist History ───────────────────────────────────────── */}
            {artistHistory.length > 0 && (
              <section className="mb-8">
                <h3 className="text-sm font-semibold text-[var(--nb-text)] mb-3">
                  Artists
                  <span className="ml-2 text-xs font-medium text-[var(--nb-text-2)]">
                    {artistHistory.length}
                  </span>
                </h3>
                <div className="flex flex-wrap gap-3">
                  {artistHistory.map((a) => {
                    const initials = a.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
                    return (
                      <div
                        key={a.artist_id}
                        className="flex items-center gap-3 bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] px-4 py-3"
                      >
                        {a.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.avatar_url} alt={a.name} className="size-9 rounded-full object-cover shrink-0" />
                        ) : (
                          <span className="size-9 rounded-full bg-[var(--nb-active-bg)] flex items-center justify-center text-sm font-semibold text-[#7C3AED] shrink-0">
                            {initials}
                          </span>
                        )}
                        <div>
                          <p className="text-sm font-medium text-[var(--nb-text)]">{a.name}</p>
                          <p className="text-xs text-[var(--nb-text-2)]">
                            {a.sessions} {a.sessions === 1 ? "session" : "sessions"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Section tabs ──────────────────────────────────────── */}
            <div className="flex rounded-lg border border-[var(--nb-border)] bg-[var(--nb-bg)] p-0.5 gap-0.5 mb-6">
              {(["requests","appointments","messages"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setApptTab(t)}
                  type="button"
                  className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors ${
                    apptTab === t
                      ? "bg-[var(--nb-card)] text-[#7C3AED] shadow-sm border border-[var(--nb-border)]"
                      : "text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
                  }`}
                >
                  {t === "requests"
                    ? `Requests (${requests.length})`
                    : t === "appointments"
                    ? `Appts (${clientAppts.length})`
                    : `Messages${waMessages.length > 0 ? ` (${waMessages.length})` : ""}`}
                </button>
              ))}
            </div>

            {/* ── Tattoo History ────────────────────────────────────────── */}
            {apptTab === "requests" && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[var(--nb-text)]">
                    Tattoo History
                    {requests.length > 0 && (
                      <span className="ml-2 text-xs font-medium text-[var(--nb-text-2)]">
                        {requests.length}
                      </span>
                    )}
                  </h3>
                  <Button
                    size="sm"
                    onClick={() => setAddRequestOpen(true)}
                    className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5"
                  >
                    <Plus size={13} />
                    Add Request
                  </Button>
                </div>

                {requests.length === 0 ? (
                  <div className="bg-[var(--nb-card)] rounded-xl border border-dashed border-[var(--nb-border)] p-8 text-center text-sm text-[var(--nb-text-2)]">
                    No tattoo requests yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {requests.map((req) => {
                      const statusStyle = getStatusStyle(req.status);
                      const isUploadingCard = uploadingCardIds.has(req.id);

                      return (
                        <div
                          key={req.id}
                          className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] overflow-hidden"
                        >
                          {/* Reference image strip */}
                          {req.reference_image_url ? (
                            <button
                              onClick={() =>
                                setLightboxUrl(req.reference_image_url!)
                              }
                              className="group relative w-full h-36 overflow-hidden block border-b border-[var(--nb-border)]"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={req.reference_image_url}
                                alt="Reference"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                <Expand
                                  size={20}
                                  className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow"
                                />
                              </div>
                            </button>
                          ) : (
                            <div className="border-b border-[var(--nb-border)] border-dashed">
                              <button
                                onClick={() =>
                                  cardImageInputRefs.current[req.id]?.click()
                                }
                                disabled={isUploadingCard}
                                className="w-full flex items-center justify-center gap-2 py-3 text-xs text-[var(--nb-text-2)] hover:text-[#7C3AED] hover:bg-[var(--nb-card)] transition-colors disabled:opacity-50"
                              >
                                {isUploadingCard ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Upload size={13} />
                                )}
                                {isUploadingCard
                                  ? "Uploading…"
                                  : "Add reference image"}
                              </button>
                              <input
                                ref={(el) => {
                                  cardImageInputRefs.current[req.id] = el;
                                }}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) =>
                                  handleCardImageUpload(req.id, e)
                                }
                              />
                            </div>
                          )}

                          {/* Card body */}
                          <div className="px-5 py-4">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <span className="inline-flex items-center rounded-full bg-[var(--nb-active-bg)] px-2.5 py-0.5 text-xs font-medium text-[#7C3AED]">
                                {req.style}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle.text} ${statusStyle.bg}`}
                                >
                                  {req.status.charAt(0).toUpperCase() +
                                    req.status.slice(1)}
                                </span>
                                <span className="text-xs text-[var(--nb-text-2)]">
                                  {formatDate(req.created_at)}
                                </span>
                              </div>
                            </div>
                            {req.description && (
                              <p className="text-sm text-[var(--nb-text)] leading-relaxed">
                                {req.description}
                              </p>
                            )}
                            {/* Send Quote via WhatsApp for quoted requests */}
                            {req.status === "quote sent" && (client.phone || parseDescription(req.description).phone) && (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => handleSendQuoteWA(req)}
                                  disabled={quoteSendingId === req.id}
                                  className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  {quoteSendingId === req.id ? <Loader2 size={10} className="animate-spin" /> : <MessageCircle size={10} />}
                                  {quoteSendingId === req.id ? "Sending…" : "Send Quote via WhatsApp"}
                                </button>
                                {quoteResult?.id === req.id && (
                                  <p className={`mt-1.5 text-[10px] rounded px-2 py-1 ${quoteResult.msg.startsWith("Quote") ? "text-emerald-700 bg-emerald-50" : "text-red-600 bg-red-50"}`}>
                                    {quoteResult.msg}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Edit / Delete actions */}
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--nb-border)]">
                              <button
                                onClick={() => { setConfirmDeleteId(null); setEditingRequest(req); }}
                                className="text-xs font-medium text-[var(--nb-text-2)] hover:text-[#7C3AED] transition-colors px-2 py-1 rounded-lg hover:bg-[var(--nb-active-bg)]"
                              >
                                Edit
                              </button>
                              <div className="ml-auto flex items-center gap-1.5">
                                {confirmDeleteId === req.id ? (
                                  <>
                                    <button
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="text-xs text-[var(--nb-text-2)] hover:text-[var(--nb-text)] px-2 py-1 rounded-lg transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => handleDeleteRequest(req.id)}
                                      disabled={deletingId === req.id}
                                      className="inline-flex items-center gap-1 text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                      {deletingId === req.id && <Loader2 size={11} className="animate-spin" />}
                                      Confirm delete?
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => handleDeleteRequest(req.id)}
                                    className="text-xs font-medium text-[var(--nb-text-2)] hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ── Appointments ──────────────────────────────────────────── */}
            {apptTab === "appointments" && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[var(--nb-text)]">
                    Appointments
                    {clientAppts.length > 0 && (
                      <span className="ml-2 text-xs font-medium text-[var(--nb-text-2)]">
                        {clientAppts.length}
                      </span>
                    )}
                  </h3>
                  <Button
                    size="sm"
                    onClick={() => setApptBookOpen(true)}
                    className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5"
                  >
                    <Plus size={13} />
                    Book
                  </Button>
                </div>
                {clientAppts.length === 0 ? (
                  <div className="bg-[var(--nb-card)] rounded-xl border border-dashed border-[var(--nb-border)] p-8 text-center text-sm text-[var(--nb-text-2)]">
                    No appointments yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {clientAppts.map((appt) => {
                      const [h, m] = appt.time.split(":").map(Number);
                      const timeStr = `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
                      const dateStr = new Date(appt.date + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short", month: "short", day: "numeric", year: "numeric",
                      });
                      const artistDisplay = appt.artists?.name ?? appt.artist_name ?? null;
                      const statusStyles: Record<string, { text: string; bg: string; dot: string }> = {
                        confirmed: { text: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-400" },
                        pending: { text: "text-amber-700", bg: "bg-amber-50", dot: "bg-amber-400" },
                        completed: { text: "text-sky-700", bg: "bg-sky-50", dot: "bg-sky-400" },
                        cancelled: { text: "text-red-700", bg: "bg-red-50", dot: "bg-red-400" },
                      };
                      const ss = statusStyles[appt.status] ?? { text: "text-[var(--nb-text-2)]", bg: "bg-[var(--nb-active-bg)]", dot: "bg-[var(--nb-border)]" };
                      return (
                        <div key={appt.id} className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] px-4 py-3 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-[var(--nb-text)]">{dateStr}</p>
                                <p className="text-xs text-[var(--nb-text-2)]">{timeStr}</p>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-xs text-[var(--nb-text-2)]">{appt.type}</span>
                                {artistDisplay && (
                                  <span className="text-xs text-[var(--nb-text-2)]">· {artistDisplay}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                              {/* Send Reminder for upcoming (not completed/cancelled) appointments */}
                              {!["completed", "cancelled"].includes(appt.status) && client.phone && (
                                <button
                                  type="button"
                                  onClick={() => handleSendReminder(appt)}
                                  disabled={reminderSendingId === appt.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors disabled:opacity-50"
                                >
                                  {reminderSendingId === appt.id ? <Loader2 size={10} className="animate-spin" /> : <MessageCircle size={10} />}
                                  Remind
                                </button>
                              )}
                              {appt.status === "completed" && client.phone && (
                                <button
                                  type="button"
                                  onClick={() => handleSendAftercare(appt.id)}
                                  disabled={aftercareSendingId === appt.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                >
                                  {aftercareSendingId === appt.id ? <Loader2 size={10} className="animate-spin" /> : <MessageCircle size={10} />}
                                  Aftercare
                                </button>
                              )}
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${ss.text} ${ss.bg}`}>
                                <span className={`size-1.5 rounded-full ${ss.dot}`} />
                                {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
                              </span>
                            </div>
                          </div>
                          {reminderResult?.id === appt.id && (
                            <p className={`text-[10px] rounded px-2 py-1 ${reminderResult.msg.startsWith("Reminder") ? "text-sky-700 bg-sky-50" : "text-red-600 bg-red-50"}`}>
                              {reminderResult.msg}
                            </p>
                          )}
                          {aftercareResult?.id === appt.id && (
                            <p className={`text-xs rounded-lg px-2.5 py-1.5 border ${aftercareResult.msg.startsWith("Aftercare") ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-600 bg-red-50 border-red-200"}`}>
                              {aftercareResult.msg}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* ── WhatsApp Messages ─────────────────────────────────────── */}
            {apptTab === "messages" && (
              <section>
                <h3 className="text-sm font-semibold text-[var(--nb-text)] mb-3">
                  WhatsApp Messages
                  {waMessages.length > 0 && (
                    <span className="ml-2 text-xs font-medium text-[var(--nb-text-2)]">
                      {waMessages.length}
                    </span>
                  )}
                </h3>
                {waMessages.length === 0 ? (
                  <div className="bg-[var(--nb-card)] rounded-xl border border-dashed border-[var(--nb-border)] p-8 text-center text-sm text-[var(--nb-text-2)]">
                    No WhatsApp messages yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {waMessages.map((msg) => {
                      const isOut = msg.direction === "outbound";
                      const statusColors: Record<string, { text: string; bg: string }> = {
                        sent:      { text: "text-sky-700",     bg: "bg-sky-50" },
                        delivered: { text: "text-emerald-700", bg: "bg-emerald-50" },
                        read:      { text: "text-violet-700",  bg: "bg-violet-50" },
                        failed:    { text: "text-red-700",     bg: "bg-red-50" },
                      };
                      const sc = statusColors[msg.status] ?? { text: "text-[var(--nb-text-2)]", bg: "bg-[var(--nb-active-bg)]" };
                      const label = msg.template_name
                        ? msg.template_name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                        : msg.message_text?.slice(0, 40) ?? "Message";
                      return (
                        <div key={msg.id} className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] px-4 py-3 flex items-center gap-3">
                          <div className={`shrink-0 size-7 rounded-full flex items-center justify-center text-xs font-bold ${isOut ? "bg-[#7C3AED]/10 text-[#7C3AED]" : "bg-emerald-50 text-emerald-600"}`}>
                            {isOut ? "↑" : "↓"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[var(--nb-text)] truncate">{label}</p>
                            <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                              {isOut ? "Sent" : "Received"} · {new Date(msg.status_updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          </div>
                          <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.text} ${sc.bg}`}>
                            {msg.status.charAt(0).toUpperCase() + msg.status.slice(1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}

      {/* Edit Tattoo Request dialog */}
      <EditRequestDialog
        open={!!editingRequest}
        onOpenChange={(v) => { if (!v) setEditingRequest(null); }}
        request={editingRequest}
        onSaved={(updated) => {
          setRequests((prev) => prev.map((r) => r.id === updated.id ? updated : r));
          setEditingRequest(null);
          showToast("Request updated!", "success");
        }}
      />

      {/* Add Tattoo Request dialog */}
      <AddRequestDialog
        open={addRequestOpen}
        onOpenChange={setAddRequestOpen}
        clientId={String(client.id)}
        clientName={client.name}
        clientEmail={client.email}
        onSuccess={(req) => {
          setRequests((prev) => [req, ...prev]);
          setAddRequestOpen(false);
          showToast("Tattoo request added!", "success");
        }}
      />

      {/* Book Appointment dialog */}
      <BookAppointmentDialog
        open={apptBookOpen}
        onOpenChange={setApptBookOpen}
        defaultClient={{ id: client.id, name: client.name, email: client.email }}
        onSuccess={() => {
          setApptBookOpen(false);
          supabase
            .from("appointments")
            .select("id, date, time, type, status, artist_name, artists(name)")
            .eq("client_id", String(client.id))
            .order("date", { ascending: false })
            .then(({ data }) => setClientAppts((data as unknown as ClientAppt[]) ?? []));
          showToast("Appointment booked!", "success");
        }}
      />

      {/* New Invoice dialog */}
      <NewInvoiceDialog
        open={invoiceOpen}
        onOpenChange={setInvoiceOpen}
        defaultClient={{ id: client.id, name: client.name, email: client.email }}
        onSuccess={() => {
          setInvoiceOpen(false);
          showToast("Invoice created!", "success");
        }}
      />

      {/* Edit Client dialog */}
      <EditClientDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
        onSuccess={(updated) => {
          onUpdated(updated);
          showToast("Client updated!", "success");
        }}
      />

      {/* Waiver view dialog */}
      {selectedWaiver && (
        <WaiverViewDialog
          waiver={selectedWaiver}
          onClose={() => setSelectedWaiver(null)}
        />
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(v) => { if (!deleting) setDeleteDialogOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {client.name}?</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{client.name}</strong> and all their appointments, invoices, tattoo requests, WhatsApp messages, and signed waivers. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteClient}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              {deleting && <Loader2 size={13} className="animate-spin" />}
              {deleting ? "Deleting…" : `Delete ${client.name.split(" ")[0]}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
}
