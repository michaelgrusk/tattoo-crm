"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormData = {
  name: string;
  email: string;
  phone: string;
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
  "Other",
];

const STEPS = ["About You", "Your Tattoo", "Reference"];

const EMPTY: FormData = {
  name: "",
  email: "",
  phone: "",
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
  "w-full rounded-xl border border-[#D6EAF0] bg-white px-4 py-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-[#1A8FAF] focus:ring-2 focus:ring-[#1A8FAF]/20 transition-colors";

const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

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
        {required && <span className="text-[#1A8FAF] ml-0.5">*</span>}
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
                    ? "bg-[#1A8FAF] border-[#1A8FAF] text-white"
                    : active
                    ? "bg-white border-[#1A8FAF] text-[#1A8FAF]"
                    : "bg-white border-[#D6EAF0] text-gray-400"
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
                <div className="flex-1 h-0.5 mx-1 bg-[#D6EAF0] overflow-hidden">
                  <div
                    className="h-full bg-[#1A8FAF] transition-all duration-300"
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
                active ? "text-[#1A8FAF]" : done ? "text-gray-500" : "text-gray-400"
              }`}
              style={i === STEPS.length - 1 ? { flexGrow: 0, width: 32 } : undefined}
            >
              {label}
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-gray-400 mt-3">
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
}: {
  studioName: string;
  slug: string;
  userId: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(EMPTY);
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
    }
    if (s === 1) {
      if (!form.description.trim()) errs.description = "Please describe your tattoo idea";
      if (!form.placement.trim()) errs.placement = "Placement is required";
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

    const lines: string[] = [form.description.trim()];
    if (form.placement.trim()) lines.push(`Placement: ${form.placement.trim()}`);
    if (form.size.trim()) lines.push(`Size: ${form.size.trim()}`);
    if (form.preferredDate) lines.push(`Preferred date: ${form.preferredDate}`);
    lines.push(`Phone: ${form.phone.trim()}`);
    const fullDescription = lines.join("\n");

    const { error } = await supabase.from("tattoo_requests").insert({
      user_id: userId,
      client_id: null,
      client_name: form.name.trim(),
      client_email: form.email.trim(),
      description: fullDescription,
      style: form.style,
      status: "new request",
      reference_image_url: imageUrl,
    });

    setSubmitting(false);

    if (error) {
      setServerError(error.message);
      return;
    }

    const params = new URLSearchParams({
      name: form.name.trim().split(" ")[0],
      style: form.style,
      hasImage: imageUrl ? "1" : "0",
    });
    router.push(`/intake/${slug}/confirmation?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-[#F0F7FA] flex flex-col items-center justify-start px-4 py-10">
      {/* Studio branding */}
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="size-12 rounded-2xl bg-[#1A8FAF] flex items-center justify-center mb-3 shadow-lg shadow-[#1A8FAF]/20">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">
          {studioName ? `Book with ${studioName}` : "Tattoo Request"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Fill out the form below and we&apos;ll get back to you soon
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-lg bg-white rounded-2xl border border-[#D6EAF0] shadow-sm px-8 py-8">
        <ProgressBar step={step} />

        {/* Step 1: About You */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">About you</h2>
            <p className="text-sm text-gray-500 mb-5">Tell us a bit about yourself so we can get in touch.</p>

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
          </div>
        )}

        {/* Step 2: Your Tattoo */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Your tattoo</h2>
            <p className="text-sm text-gray-500 mb-5">Share your vision — the more detail, the better.</p>

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
              <input type="date" value={form.preferredDate}
                onChange={(e) => set("preferredDate", e.target.value)} className={inputCls} />
            </Field>
          </div>
        )}

        {/* Step 3: Reference image */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Reference image</h2>
              <p className="text-sm text-gray-500">Optional — upload a photo that captures the vibe or style you&apos;re going for.</p>
            </div>

            {form.imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-[#D6EAF0] bg-[#F0F7FA]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.imagePreview} alt="Reference preview" className="w-full max-h-64 object-contain" />
                <button type="button" onClick={removeImage}
                  className="absolute top-3 right-3 size-8 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[#D6EAF0] bg-[#F8FCFE] hover:bg-[#F0F7FA] hover:border-[#1A8FAF]/40 py-10 text-sm text-gray-400 transition-colors group">
                <div className="size-12 rounded-full bg-[#E8F5FA] flex items-center justify-center group-hover:bg-[#D6EAF0] transition-colors">
                  <ImageIcon size={20} className="text-[#1A8FAF]" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-gray-600">Click to upload a reference image</p>
                  <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WEBP · up to 10 MB</p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1A8FAF] text-white text-xs font-medium">
                  <Upload size={13} />
                  Choose file
                </div>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />

            {/* Summary */}
            <div className="rounded-xl border border-[#D6EAF0] bg-[#F8FCFE] px-4 py-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Summary</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <span className="text-gray-400">Name</span>
                <span className="text-gray-900 font-medium truncate">{form.name || "—"}</span>
                <span className="text-gray-400">Style</span>
                <span className="text-gray-900 font-medium">{form.style}</span>
                <span className="text-gray-400">Placement</span>
                <span className="text-gray-900 font-medium">{form.placement || "—"}</span>
                {form.preferredDate && (
                  <>
                    <span className="text-gray-400">Preferred date</span>
                    <span className="text-gray-900 font-medium">
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
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-[#D6EAF0] text-sm font-medium text-gray-600 bg-white hover:bg-[#F0F7FA] transition-colors disabled:opacity-50">
              <ChevronLeft size={16} />
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#1A8FAF] hover:bg-[#157a97] text-white text-sm font-medium transition-colors shadow-sm shadow-[#1A8FAF]/20">
              Next
              <ChevronRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1A8FAF] hover:bg-[#157a97] text-white text-sm font-medium transition-colors shadow-sm shadow-[#1A8FAF]/20 disabled:opacity-60">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          )}
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-400 text-center">
        Powered by <span className="font-medium text-[#1A8FAF]">InkDesk</span>
      </p>
    </div>
  );
}
