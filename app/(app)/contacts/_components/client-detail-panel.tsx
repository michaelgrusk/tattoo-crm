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
} from "lucide-react";
import { supabase, getUserId } from "@/lib/supabase/client";
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
} from "@/components/ui/dialog";
import type { ClientListItem } from "../page";

// ─── Types ────────────────────────────────────────────────────────────────────

type TattooRequest = {
  id: string;
  description: string;
  style: string;
  status: string;
  created_at: string;
  reference_image_url: string | null;
};

type NextAppointment = {
  date: string;
  time: string;
  type: string;
  artist_name: string;
} | null;

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
      text: "text-gray-600",
      bg: "bg-gray-100",
    }
  );
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
    <div className="bg-white rounded-xl border border-[#D6EAF0] px-5 py-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className="text-xl font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
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
      .select("id, description, style, status, created_at, reference_image_url")
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
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-[#D6EAF0] bg-[#F0F7FA]">
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
                className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#D6EAF0] bg-[#F8FCFE] hover:bg-[#F0F7FA] py-6 text-sm text-gray-400 transition-colors"
              >
                <ImageIcon size={20} className="text-gray-300" />
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
            className="bg-[#1A8FAF] hover:bg-[#157a97] text-white gap-1.5"
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
            className="bg-[#1A8FAF] hover:bg-[#157a97] text-white gap-1.5"
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
  const [requests, setRequests] = useState<TattooRequest[]>([]);
  const [nextAppt, setNextAppt] = useState<NextAppointment>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string, type: "success" | "error") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  async function handleDeleteClient() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setDeleting(true);
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", client.id);
    setDeleting(false);
    if (error) {
      showToast(`Failed to delete client: ${error.message}`, "error");
      setDeleteConfirm(false);
      return;
    }
    onDeleted(client.id);
  }

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

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
      .select("id, description, style, status, created_at, reference_image_url")
      .eq("client_id", String(client.id))
      .order("created_at", { ascending: false });
    setRequests((data as TattooRequest[]) ?? []);
  }

  // Reset confirmation state when switching clients
  useEffect(() => {
    setDeleteConfirm(false);
    setDeleting(false);
  }, [client.id]);

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
        .select("date, time, type, artist_name")
        .eq("client_id", String(client.id))
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(1),
    ]).then(([{ data: reqs }, { data: appts }]) => {
      setRequests((reqs as TattooRequest[]) ?? []);
      setNextAppt((appts?.[0] as NextAppointment) ?? null);
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
      .select("id, description, style, status, created_at, reference_image_url")
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
            <div className="size-14 rounded-full bg-[#E8F5FA] flex items-center justify-center text-lg font-semibold text-[#1A8FAF] shrink-0">
              {client.name
                .trim()
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {client.name}
              </h2>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Mail size={13} className="text-gray-400" />
                  {client.email}
                </span>
                {client.phone && (
                  <span className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Phone size={13} className="text-gray-400" />
                    {client.phone}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Calendar size={13} className="text-gray-400" />
                  Client since{" "}
                  {formatDate(client.created_at, {
                    year: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#D6EAF0] bg-white text-[#1A8FAF] hover:bg-[#F0F7FA] transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleDeleteClient}
              disabled={deleting}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                deleteConfirm
                  ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                  : "bg-white text-gray-400 border-[#D6EAF0] hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              }`}
            >
              {deleting && <Loader2 size={12} className="animate-spin" />}
              {deleteConfirm ? "Confirm Delete?" : "Delete"}
            </button>
          </div>
        </div>

        {/* Stat boxes */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatBox
            label="Total Spent"
            value={`$${client.totalSpent.toLocaleString()}`}
          />
          <StatBox
            label="Sessions"
            value={String(client.sessions)}
            sub={client.sessions === 1 ? "appointment" : "appointments"}
          />
          <StatBox
            label="Next Appointment"
            value={
              loading
                ? "—"
                : nextAppt
                ? formatAppointmentDate(nextAppt.date)
                : "None scheduled"
            }
            sub={
              !loading && nextAppt
                ? `${formatTime(nextAppt.time)} · ${nextAppt.type}`
                : undefined
            }
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-8">
            <Loader2 size={16} className="animate-spin" />
            Loading client details…
          </div>
        ) : (
          <>
            {/* ── Reference Images ─────────────────────────────────────── */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  Reference Images
                  {referenceImages.length > 0 && (
                    <span className="ml-2 text-xs font-medium text-gray-400">
                      {referenceImages.length}
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => newImageInputRef.current?.click()}
                  disabled={uploadingNew}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#1A8FAF] bg-[#E8F5FA] hover:bg-[#D6EAF0] border border-[#C8DFE8] transition-colors disabled:opacity-50"
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
                <div className="rounded-xl border border-dashed border-[#D6EAF0] bg-white p-6 flex flex-col items-center gap-2 text-center">
                  <ImageIcon size={24} className="text-gray-300" />
                  <p className="text-sm text-gray-400">No reference images yet</p>
                  <p className="text-xs text-gray-300">
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
                      className="group relative aspect-square rounded-xl overflow-hidden border border-[#D6EAF0] bg-[#F0F7FA] hover:border-[#1A8FAF] transition-colors"
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
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Notes
                </h3>
                <div className="space-y-3">
                  {client.skin_notes && (
                    <div className="bg-white rounded-xl border border-[#D6EAF0] px-5 py-4">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                        Skin Notes
                      </p>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {client.skin_notes}
                      </p>
                    </div>
                  )}
                  {client.notes && (
                    <div className="bg-white rounded-xl border border-[#D6EAF0] px-5 py-4">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                        General Notes
                      </p>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {client.notes}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── Tattoo History ────────────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">
                  Tattoo History
                  {requests.length > 0 && (
                    <span className="ml-2 text-xs font-medium text-gray-400">
                      {requests.length}
                    </span>
                  )}
                </h3>
                <Button
                  size="sm"
                  onClick={() => setAddRequestOpen(true)}
                  className="bg-[#1A8FAF] hover:bg-[#157a97] text-white gap-1.5"
                >
                  <Plus size={13} />
                  Add Request
                </Button>
              </div>

              {requests.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-[#D6EAF0] p-8 text-center text-sm text-gray-400">
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
                        className="bg-white rounded-xl border border-[#D6EAF0] overflow-hidden"
                      >
                        {/* Reference image strip */}
                        {req.reference_image_url ? (
                          <button
                            onClick={() =>
                              setLightboxUrl(req.reference_image_url!)
                            }
                            className="group relative w-full h-36 overflow-hidden block border-b border-[#D6EAF0]"
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
                          <div className="border-b border-[#D6EAF0] border-dashed">
                            <button
                              onClick={() =>
                                cardImageInputRefs.current[req.id]?.click()
                              }
                              disabled={isUploadingCard}
                              className="w-full flex items-center justify-center gap-2 py-3 text-xs text-gray-400 hover:text-[#1A8FAF] hover:bg-[#F8FCFE] transition-colors disabled:opacity-50"
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
                            <span className="inline-flex items-center rounded-full bg-[#E8F5FA] px-2.5 py-0.5 text-xs font-medium text-[#1A8FAF]">
                              {req.style}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle.text} ${statusStyle.bg}`}
                              >
                                {req.status.charAt(0).toUpperCase() +
                                  req.status.slice(1)}
                              </span>
                              <span className="text-xs text-gray-400">
                                {formatDate(req.created_at)}
                              </span>
                            </div>
                          </div>
                          {req.description && (
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {req.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}

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

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </>
  );
}
