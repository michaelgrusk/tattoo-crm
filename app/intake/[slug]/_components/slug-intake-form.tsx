"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, Upload, X, ImageIcon, Loader2, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { FlashPiecePreview } from "../page";
import { AvailabilityDatePicker, type IntakeAvailabilityBlock } from "./availability-date-picker";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormData = {
  name: string;
  email: string;
  phone: string;
  instagram: string;
  whatsappOptIn: boolean;
  inquiryType: "custom" | "flash";
  selectedFlashId: string | null;
  description: string;
  style: string;
  placement: string;
  size: string;
  preferredDate: string;
  imageFile: File | null;
  imagePreview: string | null;
};

type Errors = Partial<Record<keyof FormData, string>>;

// ─── Constants ────────────────────────────────────────────────────────────────

const STYLES = [
  "Blackwork",
  "Japanese",
  "Fine line",
  "Watercolor",
  "Geometric",
  "Traditional",
  "Realism",
  "Anime",
  "Other",
];

const STEPS = ["About You", "Your Tattoo", "Reference"];

const EMPTY: FormData = {
  name: "",
  email: "",
  phone: "",
  instagram: "",
  whatsappOptIn: false,
  inquiryType: "custom",
  selectedFlashId: null,
  description: "",
  style: "Blackwork",
  placement: "",
  size: "",
  preferredDate: "",
  imageFile: null,
  imagePreview: null,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-[var(--nb-border)] bg-[var(--nb-card)] px-4 py-3 text-sm text-[var(--nb-text)] outline-none placeholder:text-[var(--nb-text-2)] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors";

const labelCls = "block text-sm font-medium text-[var(--nb-text)] mb-1.5";

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>
        {label}
        {required && <span className="text-[#7C3AED] ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center mb-3">
        {STEPS.map((_, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div
                className={`size-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 shrink-0 transition-all ${
                  done
                    ? "bg-[#7C3AED] border-[#7C3AED] text-white"
                    : active
                    ? "bg-[var(--nb-card)] border-[#7C3AED] text-[#7C3AED]"
                    : "bg-[var(--nb-card)] border-[var(--nb-border)] text-[var(--nb-text-2)]"
                }`}
              >
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-1 bg-[var(--nb-border)] overflow-hidden">
                  <div
                    className="h-full bg-[#7C3AED] transition-all duration-300"
                    style={{ width: i < step ? "100%" : "0%" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-start">
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div
              key={i}
              className={`flex-1 text-center text-[11px] font-medium last:flex-none ${
                active ? "text-[#7C3AED]" : done ? "text-[var(--nb-text-2)]" : "text-[var(--nb-text-2)]"
              }`}
              style={i === STEPS.length - 1 ? { flexGrow: 0, width: 32 } : undefined}
            >
              {label}
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-[var(--nb-text-2)] mt-3">
        Step {step + 1} of {STEPS.length}
      </p>
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function SlugIntakeForm({
  studioName,
  slug,
  userId,
  flashPieces = [],
  preselectedFlashId = null,
  availabilityBlocks = [],
}: {
  studioName: string;
  slug: string;
  userId: string;
  flashPieces?: FlashPiecePreview[];
  preselectedFlashId?: string | null;
  availabilityBlocks?: IntakeAvailabilityBlock[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(() => ({
    ...EMPTY,
    inquiryType: preselectedFlashId ? "flash" : "custom",
    selectedFlashId: preselectedFlashId ?? null,
  }));
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validateStep(s: number): Errors {
    const errs: Errors = {};
    if (s === 0) {
      if (!form.name.trim()) errs.name = "Full name is required";
      if (!form.email.trim()) errs.email = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        errs.email = "Enter a valid email address";
      if (!form.phone.trim()) errs.phone = "Phone number is required";
      if (!form.instagram.trim()) errs.instagram = "Instagram handle is required — we'll use this to send your quote";
    }
    if (s === 1) {
      if (form.inquiryType === "flash") {
        if (!form.selectedFlashId) errs.description = "Please select a flash design";
      } else {
        if (!form.description.trim()) errs.description = "Please describe your tattoo idea";
        if (!form.placement.trim()) errs.placement = "Placement is required";
      }
    }
    return errs;
  }

  function handleNext() {
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setStep((s) => s + 1);
  }

  function handleBack() {
    setStep((s) => s - 1);
    setErrors({});
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    set("imageFile", file);
    set("imagePreview", URL.createObjectURL(file));
    e.target.value = "";
  }

  function removeImage() {
    set("imageFile", null);
    set("imagePreview", null);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setServerError(null);

    let imageUrl: string | null = null;
    if (form.imageFile) {
      const ext = form.imageFile.name.split(".").pop() ?? "jpg";
      const path = `intake/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("tattoo-references")
        .upload(path, form.imageFile, { cacheControl: "3600", upsert: false });
      if (uploadError) {
        setServerError(`Image upload failed: ${uploadError.message}`);
        setSubmitting(false);
        return;
      }
      const { data } = supabase.storage.from("tattoo-references").getPublicUrl(path);
      imageUrl = data.publicUrl;
    }

    let fullDescription = "";
    if (form.inquiryType === "flash" && form.selectedFlashId) {
      const flashPiece = flashPieces.find((p) => p.id === form.selectedFlashId);
      const lines: string[] = [`Flash booking: ${flashPiece?.title ?? "Flash design"}`];
      if (form.placement.trim()) lines.push(`Placement: ${form.placement.trim()}`);
      if (form.preferredDate) lines.push(`Preferred date: ${form.preferredDate}`);
      lines.push(`Phone: ${form.phone.trim()}`);
      if (form.instagram.trim()) lines.push(`Instagram: @${form.instagram.trim()}`);
      fullDescription = lines.join("\n");
    } else {
      const lines: string[] = [form.description.trim()];
      if (form.placement.trim()) lines.push(`Placement: ${form.placement.trim()}`);
      if (form.size.trim()) lines.push(`Size: ${form.size.trim()}`);
      if (form.preferredDate) lines.push(`Preferred date: ${form.preferredDate}`);
      lines.push(`Phone: ${form.phone.trim()}`);
      if (form.instagram.trim()) lines.push(`Instagram: @${form.instagram.trim()}`);
      fullDescription = lines.join("\n");
    }

    const { data: newRequest, error } = await supabase.from("tattoo_requests").insert({
      user_id: userId,
      client_id: null,
      client_name: form.name.trim(),
      client_email: form.email.trim(),
      description: fullDescription,
      style: form.inquiryType === "flash" ? "Flash" : form.style,
      status: "new request",
      reference_image_url: imageUrl,
      whatsapp_opt_in: form.whatsappOptIn,
      inquiry_type: form.inquiryType,
      flash_piece_id: form.inquiryType === "flash" ? form.selectedFlashId : null,
      source_type: "intake_form",
    }).select("id").single();

    setSubmitting(false);

    if (error) {
      setServerError(error.message);
      return;
    }

    // Fire notification email + auto-create client — don't await, don't block redirect
    fetch("/api/notify-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        request_id: newRequest?.id ?? null,
        studio_name: studioName,
        client_name: form.name.trim(),
        client_email: form.email.trim(),
        client_phone: form.phone.trim(),
        client_instagram: form.instagram.trim() ? `@${form.instagram.trim()}` : undefined,
        description: form.description.trim(),
        style: form.style,
        placement: form.placement.trim(),
        size: form.size.trim(),
        preferred_date: form.preferredDate,
      }),
    }).catch(() => {});

    const params = new URLSearchParams({
      name: form.name.trim().split(" ")[0],
      style: form.style,
      hasImage: imageUrl ? "1" : "0",
    });
    router.push(`/intake/${slug}/confirmation?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-[var(--nb-bg)] flex flex-col items-center justify-start px-4 py-10">
      {/* Studio branding */}
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="size-12 rounded-2xl bg-[#7C3AED] flex items-center justify-center mb-3 shadow-lg shadow-[#7C3AED]/20">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-[var(--nb-text)]">
          {studioName ? `Book with ${studioName}` : "Tattoo Request"}
        </h1>
        <p className="text-sm text-[var(--nb-text-2)] mt-1">
          Fill out the form below and we&apos;ll get back to you soon
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-lg bg-[var(--nb-card)] rounded-2xl border border-[var(--nb-border)] shadow-sm px-8 py-8">
        <ProgressBar step={step} />

        {/* Step 1: About You */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--nb-text)] mb-1">About you</h2>
            <p className="text-sm text-[var(--nb-text-2)] mb-5">Tell us a bit about yourself so we can get in touch.</p>

            <Field label="Full name" required error={errors.name}>
              <input type="text" placeholder="Jane Smith" value={form.name}
                onChange={(e) => set("name", e.target.value)} className={inputCls} autoComplete="name" />
            </Field>
            <Field label="Email" required error={errors.email}>
              <input type="email" placeholder="jane@example.com" value={form.email}
                onChange={(e) => set("email", e.target.value)} className={inputCls} autoComplete="email" />
            </Field>
            <Field label="Phone number" required error={errors.phone}>
              <input type="tel" placeholder="+1 (555) 000-0000" value={form.phone}
                onChange={(e) => set("phone", e.target.value)} className={inputCls} autoComplete="tel" />
            </Field>
            <Field label="Instagram handle" required error={errors.instagram}>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[var(--nb-text-2)] select-none pointer-events-none">@</span>
                <input type="text" placeholder="yourusername" value={form.instagram}
                  onChange={(e) => set("instagram", e.target.value.replace(/^@+/, ""))} className={`${inputCls} pl-8`} autoComplete="off" />
              </div>
              <p className="mt-1.5 text-xs text-[var(--nb-text-2)]">We&apos;ll use this to send you your quote.</p>
            </Field>

            <label className="flex items-start gap-3 cursor-pointer group mt-1">
              <div className="relative flex items-center justify-center mt-0.5 shrink-0">
                <input
                  type="checkbox"
                  checked={form.whatsappOptIn}
                  onChange={(e) => set("whatsappOptIn", e.target.checked)}
                  className="peer sr-only"
                />
                <div className="size-5 rounded-md border-2 border-[var(--nb-border)] bg-[var(--nb-card)] peer-checked:bg-[#7C3AED] peer-checked:border-[#7C3AED] transition-colors flex items-center justify-center group-hover:border-[#7C3AED]/60">
                  {form.whatsappOptIn && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-[var(--nb-text-2)] leading-snug select-none">
                I agree to receive updates about my quote, deposit, appointment, and aftercare via{" "}
                <span className="text-[var(--nb-text)] font-medium">WhatsApp</span>
              </span>
            </label>
          </div>
        )}

        {/* Step 2: Your Tattoo */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[var(--nb-text)] mb-1">Your tattoo</h2>
            <p className="text-sm text-[var(--nb-text-2)] mb-5">Tell us what you&apos;re looking for.</p>

            {/* Type selector — only show if flash pieces exist */}
            {flashPieces.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { set("inquiryType", "custom"); set("selectedFlashId", null); }}
                  className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                    form.inquiryType === "custom"
                      ? "border-[#7C3AED] bg-[#7C3AED]/5 text-[#7C3AED]"
                      : "border-[var(--nb-border)] text-[var(--nb-text-2)] hover:border-[#7C3AED]/40"
                  }`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  Custom tattoo
                </button>
                <button
                  type="button"
                  onClick={() => set("inquiryType", "flash")}
                  className={`flex flex-col items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                    form.inquiryType === "flash"
                      ? "border-[#7C3AED] bg-[#7C3AED]/5 text-[#7C3AED]"
                      : "border-[var(--nb-border)] text-[var(--nb-text-2)] hover:border-[#7C3AED]/40"
                  }`}
                >
                  <Zap size={20} />
                  Flash design
                </button>
              </div>
            )}

            {/* Custom tattoo fields */}
            {form.inquiryType === "custom" && (
              <>
                <Field label="Tattoo description" required error={errors.description}>
                  <textarea placeholder="Describe your idea — subject matter, mood, any specific elements…"
                    value={form.description} onChange={(e) => set("description", e.target.value)}
                    rows={4} className={`${inputCls} resize-none`} />
                </Field>

                <Field label="Style">
                  <select value={form.style} onChange={(e) => set("style", e.target.value)} className={inputCls}>
                    {STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Placement" required error={errors.placement}>
                    <input type="text" placeholder="e.g. Left forearm" value={form.placement}
                      onChange={(e) => set("placement", e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Rough size">
                    <input type="text" placeholder='e.g. "palm sized"' value={form.size}
                      onChange={(e) => set("size", e.target.value)} className={inputCls} />
                  </Field>
                </div>

                <Field label="Preferred appointment date">
                  <AvailabilityDatePicker
                    value={form.preferredDate}
                    onChange={(date) => set("preferredDate", date)}
                    blocks={availabilityBlocks}
                  />
                </Field>
              </>
            )}

            {/* Flash picker */}
            {form.inquiryType === "flash" && (
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>
                    Select a design <span className="text-[#7C3AED]">*</span>
                  </label>
                  {errors.description && (
                    <p className="mb-2 text-xs text-red-500">{errors.description}</p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {flashPieces.map((piece) => (
                      <button
                        key={piece.id}
                        type="button"
                        onClick={() => set("selectedFlashId", piece.id)}
                        className={`rounded-xl border-2 overflow-hidden text-left transition-all ${
                          form.selectedFlashId === piece.id
                            ? "border-[#7C3AED] ring-2 ring-[#7C3AED]/20"
                            : "border-[var(--nb-border)] hover:border-[#7C3AED]/40"
                        }`}
                      >
                        {piece.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={piece.image_url} alt={piece.title} className="w-full aspect-square object-cover" />
                        ) : (
                          <div className="w-full aspect-square bg-[var(--nb-active-bg)] flex items-center justify-center">
                            <Zap size={24} className="text-[#7C3AED]" />
                          </div>
                        )}
                        <div className="p-2.5">
                          <p className="text-xs font-semibold text-[var(--nb-text)] truncate">{piece.title}</p>
                          {piece.price != null && (
                            <p className="text-xs text-[var(--nb-text-2)] mt-0.5">${piece.price}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <Field label="Placement">
                  <input type="text" placeholder="e.g. Left forearm" value={form.placement}
                    onChange={(e) => set("placement", e.target.value)} className={inputCls} />
                </Field>

                <Field label="Preferred appointment date">
                  <AvailabilityDatePicker
                    value={form.preferredDate}
                    onChange={(date) => set("preferredDate", date)}
                    blocks={availabilityBlocks}
                  />
                </Field>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Reference image */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-[var(--nb-text)] mb-1">Reference image</h2>
              <p className="text-sm text-[var(--nb-text-2)]">Optional — upload a photo that captures the vibe or style you&apos;re going for.</p>
            </div>

            {form.imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-[var(--nb-border)] bg-[var(--nb-bg)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.imagePreview} alt="Reference preview" className="w-full max-h-64 object-contain" />
                <button type="button" onClick={removeImage}
                  className="absolute top-3 right-3 size-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--nb-border)] bg-[var(--nb-card)] hover:bg-[var(--nb-bg)] hover:border-[#7C3AED]/40 py-10 text-sm text-[var(--nb-text-2)] transition-colors group">
                <div className="size-12 rounded-full bg-[var(--nb-active-bg)] flex items-center justify-center group-hover:bg-[var(--nb-border)] transition-colors">
                  <ImageIcon size={20} className="text-[#7C3AED]" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-[var(--nb-text-2)]">Click to upload a reference image</p>
                  <p className="text-xs text-[var(--nb-text-2)] mt-0.5">PNG, JPG, WEBP · up to 10 MB</p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#7C3AED] text-white text-xs font-medium">
                  <Upload size={13} />
                  Choose file
                </div>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />

            {/* Summary */}
            <div className="rounded-xl border border-[var(--nb-border)] bg-[var(--nb-card)] px-4 py-4 space-y-2">
              <p className="text-xs font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-2">Summary</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <span className="text-[var(--nb-text-2)]">Name</span>
                <span className="text-[var(--nb-text)] font-medium truncate">{form.name || "—"}</span>
                <span className="text-[var(--nb-text-2)]">Type</span>
                <span className="text-[var(--nb-text)] font-medium capitalize">{form.inquiryType}</span>
                {form.inquiryType === "flash" && form.selectedFlashId ? (
                  <>
                    <span className="text-[var(--nb-text-2)]">Design</span>
                    <span className="text-[var(--nb-text)] font-medium truncate">
                      {flashPieces.find((p) => p.id === form.selectedFlashId)?.title ?? "—"}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[var(--nb-text-2)]">Style</span>
                    <span className="text-[var(--nb-text)] font-medium">{form.style}</span>
                  </>
                )}
                <span className="text-[var(--nb-text-2)]">Placement</span>
                <span className="text-[var(--nb-text)] font-medium">{form.placement || "—"}</span>
                {form.preferredDate && (
                  <>
                    <span className="text-[var(--nb-text-2)]">Preferred date</span>
                    <span className="text-[var(--nb-text)] font-medium">
                      {new Date(form.preferredDate + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </span>
                  </>
                )}
              </div>
            </div>

            {serverError && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                {serverError}
              </p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className={`flex mt-8 ${step > 0 ? "justify-between" : "justify-end"}`}>
          {step > 0 && (
            <button type="button" onClick={handleBack} disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-[var(--nb-border)] text-sm font-medium text-[var(--nb-text-2)] bg-[var(--nb-card)] hover:bg-[var(--nb-bg)] transition-colors disabled:opacity-50">
              <ChevronLeft size={16} />
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium transition-colors shadow-sm shadow-[#7C3AED]/20">
              Next
              <ChevronRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium transition-colors shadow-sm shadow-[#7C3AED]/20 disabled:opacity-60">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-[var(--nb-text-2)] text-center">
        Powered by <span className="font-medium text-[#7C3AED]">Needlebook</span>
      </p>
    </div>
  );
}
