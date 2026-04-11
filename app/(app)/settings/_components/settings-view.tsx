"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, Camera, X, Plus, Pencil, Trash2, GripVertical, Zap, Star } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { CURRENCY_OPTIONS, formatCurrency } from "@/lib/currency";
import { FlashPieceModal, type FlashPiece } from "./flash-piece-modal";
import type { CurrencyCode } from "@/lib/currency";
import { Calendar, Copy, CheckCircle2 as CopyCheck, ExternalLink, Globe } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReviewRow = {
  id: number;
  created_at: string;
  rating: number;
  comment: string | null;
  reviewer_name: string | null;
  is_anonymous: boolean;
  is_displayed: boolean;
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-2.5 text-sm text-[var(--nb-text)] outline-none placeholder:text-[var(--nb-text-2)] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors";

const labelCls = "block text-sm font-medium text-[var(--nb-text)] mb-1.5";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--nb-card)] rounded-2xl border border-[var(--nb-border)] shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-[var(--nb-border)]">
        <h2 className="text-base font-semibold text-[var(--nb-text)]">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-[var(--nb-text-2)]">{description}</p>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastState = { msg: string; type: "success" | "error" } | null;

function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  const isSuccess = toast.type === "success";
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium animate-in slide-in-from-bottom-4 fade-in duration-200 ${
        isSuccess ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 size={16} className="shrink-0" />
      ) : (
        <AlertCircle size={16} className="shrink-0" />
      )}
      {toast.msg}
    </div>
  );
}

// ─── Copy review link button ──────────────────────────────────────────────────

function CopyReviewLinkButton({ slug, mounted }: { slug: string; mounted: boolean }) {
  const [copied, setCopied] = useState(false);
  const url = mounted
    ? `${window.location.origin}/review/${slug}`
    : `https://needlebook-crm.vercel.app/review/${slug}`;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-[var(--nb-border)] text-sm font-medium text-[var(--nb-text-2)] hover:bg-[var(--nb-bg)] transition-colors"
    >
      {copied ? <CopyCheck size={14} className="text-emerald-500" /> : <Copy size={14} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsView({
  initialStudioName,
  initialSlug,
  initialCurrency,
  initialBio,
  initialLocation,
  initialShowPortfolio,
  initialPortfolioLimit,
  initialShowPricingInfo,
  initialPricingNote,
  initialAvatarUrl,
  initialFlashEnabled,
  initialFlashPreviewCount,
  userId,
}: {
  initialStudioName: string;
  initialSlug: string;
  initialCurrency: string;
  initialBio: string;
  initialLocation: string;
  initialShowPortfolio: boolean;
  initialPortfolioLimit: number;
  initialShowPricingInfo: boolean;
  initialPricingNote: string;
  initialAvatarUrl: string | null;
  initialFlashEnabled: boolean;
  initialFlashPreviewCount: number;
  userId: string;
}) {
  const router = useRouter();

  // Studio profile
  const [studioName, setStudioName] = useState(initialStudioName);
  const [slug, setSlug] = useState(initialSlug);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Public studio page
  const [bio, setBio] = useState(initialBio);
  const [location, setLocation] = useState(initialLocation);
  const [showPortfolio, setShowPortfolio] = useState(initialShowPortfolio);
  const [portfolioLimit, setPortfolioLimit] = useState(initialPortfolioLimit);
  const [showPricingInfo, setShowPricingInfo] = useState(initialShowPricingInfo);
  const [pricingNote, setPricingNote] = useState(initialPricingNote);
  const [studioPageSaving, setStudioPageSaving] = useState(false);

  // Flash tattoos
  const [flashEnabled, setFlashEnabled] = useState(initialFlashEnabled);
  const [flashPreviewCount, setFlashPreviewCount] = useState(initialFlashPreviewCount);
  const [flashPieces, setFlashPieces] = useState<FlashPiece[]>([]);
  const [flashLoading, setFlashLoading] = useState(false);
  const [flashSettingsSaving, setFlashSettingsSaving] = useState(false);
  const [flashModalOpen, setFlashModalOpen] = useState(false);
  const [flashModalPiece, setFlashModalPiece] = useState<FlashPiece | null>(null);
  const [flashDeleting, setFlashDeleting] = useState<string | null>(null);

  // Reviews
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewToggling, setReviewToggling] = useState<number | null>(null);

  // Currency
  const [currency, setCurrency] = useState<CurrencyCode>(
    (initialCurrency as CurrencyCode) ?? "USD"
  );
  const [currencySaving, setCurrencySaving] = useState(false);

  // Calendar feed
  const [calCopied, setCalCopied] = useState(false);
  const [slugError, setSlugError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // AI
  const [aiAutoAnalyze, setAiAutoAnalyze] = useState(true);
  const [aiSaving, setAiSaving] = useState(false);

  // Quote templates (persisted to whatsapp_templates table)
  const QT_DEFAULTS: Record<string, { label: string; body: string }> = {
    quote: {
      label: "Quote",
      body: "Hi {{client_name}}! 🖋️ Thanks for reaching out to {{studio_name}}.\n\nWe'd love to work on your tattoo — {{tattoo_description}} sounds awesome, we'd love to get this going!\n\nHere's our estimated quote:\n💰 *{{total_amount}}*\n\nTo secure your spot, a deposit of {{deposit_amount}} is required.\nAccepted payment methods: BIT, Bank Transfer.\n\nWe're excited to work with you — reply if you have any questions! 🙏",
    },
    deposit_followup: {
      label: "Deposit Follow-up",
      body: "Hey {{client_name}}! 👋 Just following up on the quote we sent for your tattoo.\n\nTo confirm your booking, we need the deposit of {{deposit_amount}}.\nPayment methods: BIT, Bank Transfer.\n\nLet us know if you have any questions — we'd love to get you booked in! 🖋️",
    },
    aftercare: {
      label: "Aftercare",
      body: "Hey {{client_name}}! 🖋️ Thanks so much for coming in today — it was a pleasure working on your piece!\n\nHere are your aftercare instructions:\n- Keep it clean and moisturised\n- Avoid sun, swimming and picking for 2 weeks\n- If you have any concerns, don't hesitate to reach out\n\nLooking forward to seeing the healed result! 💜",
    },
    reminder: {
      label: "Appointment Reminder",
      body: "Hey {{client_name}}! 🖋️ Just a reminder that your tattoo appointment is coming up on {{appointment_date}}.\n\nPlease remember to:\n- Eat a good meal beforehand\n- Stay hydrated\n- Wear comfortable clothing that allows easy access to the tattoo area\n- Get a good night's sleep\n\nIf you need to reschedule, please let us know as soon as possible.\n\nSee you soon! — {{artist_name}}",
    },
    touchup: {
      label: "Touch-up Follow-up",
      body: "Hey {{client_name}}! 👋 It's been a while since your session at {{studio_name}}!\n\nTattoos sometimes need a little touch-up after healing — especially in areas that see a lot of movement or sun exposure.\n\nIf you feel like your piece could use some love, reply here and we'll take a look. Touch-ups are usually quick and affordable.\n\nHope you're loving your ink! 🖋️",
    },
    confirmation: {
      label: "Booking Confirmation",
      body: "Hey {{client_name}}! ✅ Your tattoo appointment is confirmed!\n\n📅 Date: {{appointment_date}}\n🎨 Type: {{tattoo_description}}\n💰 Deposit paid: {{deposit_amount}}\n\nPlease arrive 10 minutes early. If anything changes, let us know ASAP.\n\nWe're looking forward to working with you! — {{studio_name}} 🙏",
    },
  };
  const [qtBodies, setQtBodies] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(QT_DEFAULTS).map(([k, v]) => [k, v.body]))
  );
  const [qtEditing, setQtEditing] = useState<string | null>(null);
  const [qtEditingBody, setQtEditingBody] = useState("");
  const [qtSaving, setQtSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState<ToastState>(null);

  // Mounted (for window.location)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Load ai_auto_analyze from profiles
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("ai_auto_analyze")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.ai_auto_analyze != null) setAiAutoAnalyze(data.ai_auto_analyze);
        });
    });
  }, []);

  async function handleAiAutoAnalyzeToggle() {
    const next = !aiAutoAnalyze;
    setAiAutoAnalyze(next);
    setAiSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ ai_auto_analyze: next })
        .eq("id", user.id);
    }
    setAiSaving(false);
  }

  // Load quote templates from DB on mount
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("whatsapp_templates")
        .select("category, body_text")
        .eq("user_id", user.id)
        .in("category", ["quote", "deposit_followup", "aftercare", "reminder", "touchup", "confirmation"]);
      if (data && data.length > 0) {
        const loaded: Record<string, string> = {};
        for (const row of data) if (row.body_text) loaded[row.category] = row.body_text;
        setQtBodies((prev) => ({ ...prev, ...loaded }));
      }
    });
  }, []);

  // Load reviews
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setReviewsLoading(false); return; }
      const { data } = await supabase
        .from("reviews")
        .select("id, created_at, rating, comment, reviewer_name, is_anonymous, is_displayed")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setReviews((data as ReviewRow[]) ?? []);
      setReviewsLoading(false);
    });
  }, []);

  async function handleToggleReview(id: number, current: boolean) {
    setReviewToggling(id);
    await supabase.from("reviews").update({ is_displayed: !current }).eq("id", id);
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_displayed: !current } : r))
    );
    setReviewToggling(null);
  }

  async function handleSaveQtTemplate(category: string) {
    setQtSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setQtSaving(false); return; }

    // Select first, then update or insert — avoids relying on a DB unique constraint
    const { data: existing } = await supabase
      .from("whatsapp_templates")
      .select("id")
      .eq("user_id", user.id)
      .eq("category", category)
      .maybeSingle();

    let error;
    if (existing?.id) {
      ({ error } = await supabase
        .from("whatsapp_templates")
        .update({ body_text: qtEditingBody, name: category })
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase
        .from("whatsapp_templates")
        .insert({ user_id: user.id, category, body_text: qtEditingBody, name: category }));
    }

    setQtSaving(false);
    if (error) { showToast(error.message, "error"); return; }
    setQtBodies((prev) => ({ ...prev, [category]: qtEditingBody }));
    setQtEditing(null);
    showToast("Template saved");
  }

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Slug validation ──────────────────────────────────────────────────────

  function handleSlugChange(val: string) {
    setSlug(val);
    if (val && !/^[a-z0-9-]+$/.test(val)) {
      setSlugError("Only lowercase letters, numbers, and hyphens");
    } else {
      setSlugError("");
    }
  }

  // ── Save profile ─────────────────────────────────────────────────────────

  async function handleSaveProfile() {
    if (!slug.trim()) {
      setSlugError("Slug is required");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setSlugError("Only lowercase letters, numbers, and hyphens");
      return;
    }
    setSlugError("");
    setProfileSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showToast("Not authenticated", "error");
      setProfileSaving(false);
      return;
    }

    // Update auth user_metadata so sidebar picks up the new name
    const [{ error: metaError }, { error: profileError }] = await Promise.all([
      supabase.auth.updateUser({ data: { studio_name: studioName.trim() } }),
      supabase
        .from("profiles")
        .update({ studio_name: studioName.trim(), slug: slug.trim() })
        .eq("id", user.id),
    ]);

    setProfileSaving(false);

    if (metaError || profileError) {
      const raw = profileError?.message ?? metaError?.message ?? "Failed to save";
      showToast(
        raw.toLowerCase().includes("unique") ? "That slug is already taken" : raw,
        "error"
      );
    } else {
      showToast("Profile saved!");
    }
  }

  // ── Avatar upload / remove ───────────────────────────────────────────────

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      showToast(uploadError.message, "error");
      setAvatarUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: dbError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);

    setAvatarUploading(false);
    if (dbError) { showToast(dbError.message, "error"); return; }
    setAvatarUrl(publicUrl);
    showToast("Profile photo saved!");
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  }

  async function handleAvatarRemove() {
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", userId);
    if (error) { showToast(error.message, "error"); return; }
    setAvatarUrl(null);
    showToast("Profile photo removed");
  }

  // ── Load flash pieces ────────────────────────────────────────────────────

  useEffect(() => {
    setFlashLoading(true);
    supabase
      .from("flash_pieces")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setFlashPieces((data as FlashPiece[]) ?? []);
        setFlashLoading(false);
      });
  }, [userId]);

  async function handleSaveFlashSettings() {
    setFlashSettingsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ flash_enabled: flashEnabled, flash_preview_count: flashPreviewCount })
      .eq("id", userId);
    setFlashSettingsSaving(false);
    if (error) showToast(error.message, "error"); else showToast("Flash settings saved!");
  }

  async function handleDeleteFlashPiece(id: string) {
    setFlashDeleting(id);
    await supabase.from("flash_pieces").delete().eq("id", id);
    setFlashPieces((prev) => prev.filter((p) => p.id !== id));
    setFlashDeleting(null);
  }

  function handleFlashPieceSaved(piece: FlashPiece) {
    setFlashPieces((prev) => {
      const idx = prev.findIndex((p) => p.id === piece.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = piece;
        return next;
      }
      return [...prev, piece];
    });
    setFlashModalOpen(false);
    setFlashModalPiece(null);
    showToast(flashModalPiece ? "Flash piece updated!" : "Flash piece added!");
  }

  // ── Save studio page settings ────────────────────────────────────────────

  async function handleSaveStudioPage() {
    setStudioPageSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showToast("Not authenticated", "error"); setStudioPageSaving(false); return; }

    const { error } = await supabase
      .from("profiles")
      .update({
        bio: bio.trim() || null,
        location: location.trim() || null,
        show_portfolio: showPortfolio,
        portfolio_limit: portfolioLimit,
        show_pricing_info: showPricingInfo,
        pricing_note: pricingNote.trim() || null,
      })
      .eq("id", user.id);

    setStudioPageSaving(false);
    if (error) { showToast(error.message, "error"); } else { showToast("Studio page saved!"); }
  }

  // ── Save currency ────────────────────────────────────────────────────────

  async function handleSaveCurrency() {
    setCurrencySaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      showToast("Not authenticated", "error");
      setCurrencySaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ currency })
      .eq("id", user.id);

    setCurrencySaving(false);

    if (error) {
      showToast(error.message, "error");
    } else {
      showToast("Currency saved!");
      router.refresh();
    }
  }

  // ── Change password ──────────────────────────────────────────────────────

  async function handleUpdatePassword() {
    if (newPw.length < 6) {
      showToast("New password must be at least 6 characters", "error");
      return;
    }
    if (newPw !== confirmPw) {
      showToast("Passwords don't match", "error");
      return;
    }

    setPwSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      showToast("Not authenticated", "error");
      setPwSaving(false);
      return;
    }

    // Verify current password before updating
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPw,
    });

    if (verifyError) {
      showToast("Current password is incorrect", "error");
      setPwSaving(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);

    if (error) {
      showToast(error.message, "error");
    } else {
      showToast("Password updated!");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    }
  }

  // ── Delete account ───────────────────────────────────────────────────────

  async function handleDeleteAccount() {
    setDeleting(true);

    const res = await fetch("/api/delete-account", { method: "POST" });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error ?? "Failed to delete account", "error");
      setDeleting(false);
      return;
    }

    await supabase.auth.signOut();
    router.push("/login");
  }

  // ── Intake URL preview ───────────────────────────────────────────────────

  const host = mounted ? window.location.host : "needlebook.app";
  const protocol = mounted ? window.location.protocol : "https:";
  const intakePreview = slug.trim()
    ? `${host}/intake/${slug.trim()}`
    : `${host}/intake/your-slug`;
  const calFeedUrl = slug.trim()
    ? `${protocol}//${host}/api/calendar/${slug.trim()}`
    : null;
  const studioPageUrl = slug.trim()
    ? `${protocol}//${host}/studio/${slug.trim()}`
    : null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="p-8 max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-[var(--nb-text)]">Settings</h1>
          <p className="mt-1 text-sm text-[var(--nb-text-2)]">
            Manage your studio profile and account
          </p>
        </div>

        {/* ── Profile Photo ──────────────────────────────────────────────── */}
        <SectionCard
          title="Profile Photo"
          description="Your studio avatar shown in the sidebar and on your public studio page."
        >
          <div className="flex items-center gap-5">
            {/* Avatar preview */}
            <div className="relative shrink-0">
              <div className="size-16 rounded-full bg-[var(--nb-active-bg)] flex items-center justify-center text-2xl font-semibold text-[#7C3AED] overflow-hidden">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="Profile photo" width={64} height={64} className="size-16 rounded-full object-cover" unoptimized />
                ) : (
                  <span>{initialStudioName ? initialStudioName[0].toUpperCase() : "?"}</span>
                )}
              </div>
              {avatarUploading && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <Loader2 size={18} className="animate-spin text-white" />
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleAvatarUpload}
              />
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--nb-border)] bg-[var(--nb-card)] text-sm font-medium text-[var(--nb-text)] hover:bg-[var(--nb-bg)] transition-colors disabled:opacity-60"
              >
                <Camera size={14} />
                {avatarUrl ? "Change Photo" : "Upload Photo"}
              </button>
              {avatarUrl && (
                <button
                  onClick={handleAvatarRemove}
                  disabled={avatarUploading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-60"
                >
                  <X size={14} />
                  Remove Photo
                </button>
              )}
            </div>
          </div>
        </SectionCard>

        {/* ── Studio Profile ─────────────────────────────────────────────── */}
        <SectionCard
          title="Studio Profile"
          description="Update your studio name and public intake URL."
        >
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Studio name</label>
              <input
                type="text"
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
                placeholder="e.g. Midnight Ink Studio"
                className={inputCls}
                dir="auto"
              />
            </div>

            <div>
              <label className={labelCls}>Intake form URL slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="e.g. midnight-ink"
                className={`${inputCls} ${slugError ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""}`}
              />
              {slugError ? (
                <p className="mt-1.5 text-xs text-red-500">{slugError}</p>
              ) : (
                <p className="mt-1.5 text-xs text-[var(--nb-text-2)] font-mono">
                  {intakePreview}
                </p>
              )}
            </div>

            <div className="pt-1">
              <button
                onClick={handleSaveProfile}
                disabled={profileSaving || !!slugError}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {profileSaving && <Loader2 size={14} className="animate-spin" />}
                {profileSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </SectionCard>

        {/* ── Change Password ────────────────────────────────────────────── */}
        <SectionCard title="Change Password">
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Current password</label>
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="••••••••"
                className={inputCls}
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className={labelCls}>New password</label>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="••••••••"
                className={inputCls}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className={labelCls}>Confirm new password</label>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
                className={inputCls}
                autoComplete="new-password"
              />
            </div>

            <div className="pt-1">
              <button
                onClick={handleUpdatePassword}
                disabled={pwSaving || !currentPw || !newPw || !confirmPw}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {pwSaving && <Loader2 size={14} className="animate-spin" />}
                {pwSaving ? "Updating…" : "Update Password"}
              </button>
            </div>
          </div>
        </SectionCard>

        {/* ── Currency ──────────────────────────────────────────────────── */}
        <SectionCard
          title="Currency"
          description="Choose the currency used across invoices, analytics, and client spend."
        >
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Currency</label>
              <div className="relative">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                  className={`${inputCls} appearance-none pr-9 cursor-pointer`}
                >
                  {CURRENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--nb-text-2)]"
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              <p className="mt-1.5 text-xs text-[var(--nb-text-2)]">
                Amounts will display as:{" "}
                <span className="font-medium text-[var(--nb-text)]">
                  {formatCurrency(1250, currency)}
                </span>
              </p>
            </div>

            <div className="pt-1">
              <button
                onClick={handleSaveCurrency}
                disabled={currencySaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {currencySaving && <Loader2 size={14} className="animate-spin" />}
                {currencySaving ? "Saving…" : "Save Currency"}
              </button>
            </div>
          </div>
        </SectionCard>

        {/* ── Sync to Calendar ──────────────────────────────────────────── */}
        <SectionCard
          title="Sync to Calendar"
          description="Subscribe to your Needlebook appointments in Google Calendar, Apple Calendar, or Outlook."
        >
          {!slug.trim() ? (
            <p className="text-sm text-[var(--nb-text-2)]">
              Set your intake form URL slug above to generate your calendar feed URL.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Feed URL */}
              <div>
                <label className={labelCls}>Your calendar feed URL</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] overflow-hidden">
                    <Calendar size={14} className="text-[var(--nb-text-2)] shrink-0" />
                    <span className="text-sm text-[var(--nb-text-2)] font-mono truncate select-all">
                      {calFeedUrl}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (!calFeedUrl) return;
                      navigator.clipboard.writeText(calFeedUrl);
                      setCalCopied(true);
                      setTimeout(() => setCalCopied(false), 2500);
                    }}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-[var(--nb-border)] bg-[var(--nb-card)] text-sm font-medium text-[var(--nb-text-2)] hover:text-[var(--nb-text)] hover:bg-[var(--nb-bg)] transition-colors"
                    title="Copy URL"
                  >
                    {calCopied
                      ? <CopyCheck size={14} className="text-emerald-600" />
                      : <Copy size={14} />
                    }
                    {calCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <p className="text-sm text-[var(--nb-text-2)] leading-relaxed">
                Subscribe to this URL in your calendar app to see your Needlebook appointments alongside your personal events. The feed updates automatically every hour.
              </p>

              {/* Google Calendar button */}
              {calFeedUrl && (
                <a
                  href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(calFeedUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--nb-border)] bg-[var(--nb-card)] text-sm font-medium text-[var(--nb-text)] hover:bg-[var(--nb-bg)] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Open in Google Calendar
                  <ExternalLink size={12} className="text-[var(--nb-text-2)]" />
                </a>
              )}
            </div>
          )}
        </SectionCard>

        {/* ── Quote Templates ─────────────────────────────────────────────── */}
        <SectionCard
          title="Quote Templates"
          description="Customise the message templates used when generating quotes for clients."
        >
          <div className="space-y-4">
            {(Object.keys(QT_DEFAULTS) as string[]).map((key) => {
              const label = QT_DEFAULTS[key].label;
              const body = qtBodies[key] ?? QT_DEFAULTS[key].body;
              // Auto-detect variables from the current body
              const vars = Array.from(new Set([...body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])));
              const isEditing = qtEditing === key;
              return (
                <div key={key} className="rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] overflow-hidden">
                  <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[var(--nb-border)]">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--nb-text)]">{label}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {vars.map((v) => (
                          <span key={v} className="rounded-full bg-[var(--nb-active-bg)] text-[#7C3AED] px-2 py-0.5 text-[10px] font-medium">
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (isEditing) {
                          setQtEditing(null);
                        } else {
                          setQtEditing(key);
                          setQtEditingBody(body);
                        }
                      }}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--nb-border)] text-[var(--nb-text-2)] hover:text-[#7C3AED] hover:border-[#7C3AED]/40 transition-colors"
                    >
                      {isEditing ? "Cancel" : "Edit"}
                    </button>
                  </div>

                  {!isEditing && (
                    <div className="px-4 py-3">
                      <p className="text-xs text-[var(--nb-text-2)] whitespace-pre-line leading-relaxed line-clamp-4">
                        {body}
                      </p>
                    </div>
                  )}

                  {isEditing && (
                    <div className="px-4 py-4 space-y-3 bg-[var(--nb-card)]">
                      <textarea
                        value={qtEditingBody}
                        onChange={(e) => setQtEditingBody(e.target.value)}
                        rows={8}
                        dir="auto"
                        className="w-full rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-3 py-2.5 text-sm text-[var(--nb-text)] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors resize-none font-mono"
                      />
                      <p className="text-[11px] text-[var(--nb-text-2)]">
                        Use <span className="font-mono text-[#7C3AED]">{"{{variable}}"}</span> syntax — e.g. <span className="font-mono text-[#7C3AED]">{"{{client_name}}"}</span>, <span className="font-mono text-[#7C3AED]">{"{{total_amount}}"}</span>
                      </p>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setQtEditing(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--nb-border)] text-[var(--nb-text-2)] hover:bg-[var(--nb-bg)] transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveQtTemplate(key)}
                          disabled={qtSaving}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#7C3AED] hover:bg-[#6D28D9] text-white transition-colors disabled:opacity-60"
                        >
                          {qtSaving && <Loader2 size={11} className="animate-spin" />}
                          Save Template
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* ── AI Settings ──────────────────────────────────────────────── */}
        <SectionCard
          title="AI Brief Intelligence"
          description="Automatically analyze new tattoo intake requests using AI to score fit, estimate session length, and flag issues."
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--nb-text)]">Auto-analyze new requests</p>
              <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                When enabled, every incoming intake request is automatically analyzed by AI. You can also trigger analysis manually from the request detail view.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAiAutoAnalyzeToggle}
              disabled={aiSaving}
              role="switch"
              aria-checked={aiAutoAnalyze}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED] disabled:cursor-not-allowed disabled:opacity-50 ${
                aiAutoAnalyze ? "bg-[#7C3AED]" : "bg-[var(--nb-border)]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
                  aiAutoAnalyze ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </SectionCard>

        {/* ── Public Studio Page ─────────────────────────────────────────── */}
        <SectionCard
          title="Public Studio Page"
          description="Customise the public page clients see when they visit your studio link."
        >
          <div className="space-y-5">
            {/* View link */}
            {studioPageUrl && (
              <a
                href={studioPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#7C3AED]/30 bg-[#7C3AED]/5 text-sm font-medium text-[#7C3AED] hover:bg-[#7C3AED]/10 transition-colors"
              >
                <Globe size={14} />
                View your studio page
                <ExternalLink size={12} className="opacity-70" />
              </a>
            )}

            {/* Bio */}
            <div>
              <label className={labelCls}>Bio</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="e.g. Auckland-based tattoo artist specializing in Japanese and blackwork…"
                className={`${inputCls} resize-none`}
                dir="auto"
              />
            </div>

            {/* Location */}
            <div>
              <label className={labelCls}>Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Tel Aviv, Israel"
                className={inputCls}
                dir="auto"
              />
            </div>

            {/* Show portfolio toggle */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--nb-text)]">Show portfolio</p>
                <p className="text-xs text-[var(--nb-text-2)] mt-0.5">Display recent work photos on your studio page</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPortfolio((v) => !v)}
                role="switch"
                aria-checked={showPortfolio}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors ${showPortfolio ? "bg-[#7C3AED]" : "bg-[var(--nb-border)]"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${showPortfolio ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Portfolio limit */}
            {showPortfolio && (
              <div>
                <label className={labelCls}>Portfolio pieces to show</label>
                <input
                  type="number"
                  min={1}
                  max={48}
                  value={portfolioLimit}
                  onChange={(e) => setPortfolioLimit(Math.max(1, parseInt(e.target.value) || 12))}
                  className={`${inputCls} max-w-[120px]`}
                />
              </div>
            )}

            {/* Show pricing toggle */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--nb-text)]">Show pricing info</p>
                <p className="text-xs text-[var(--nb-text-2)] mt-0.5">Display a pricing note on your studio page</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPricingInfo((v) => !v)}
                role="switch"
                aria-checked={showPricingInfo}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors ${showPricingInfo ? "bg-[#7C3AED]" : "bg-[var(--nb-border)]"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${showPricingInfo ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Pricing note */}
            {showPricingInfo && (
              <div>
                <label className={labelCls}>Pricing note</label>
                <textarea
                  rows={3}
                  value={pricingNote}
                  onChange={(e) => setPricingNote(e.target.value)}
                  placeholder="e.g. Starting from ₪300 for small pieces. Larger pieces priced by session."
                  className={`${inputCls} resize-none`}
                  dir="auto"
                />
              </div>
            )}

            <div className="pt-1">
              <button
                onClick={handleSaveStudioPage}
                disabled={studioPageSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {studioPageSaving && <Loader2 size={14} className="animate-spin" />}
                {studioPageSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </SectionCard>

        {/* ── Flash Tattoos ──────────────────────────────────────────────── */}
        <SectionCard
          title="Flash Tattoos"
          description="Manage flash designs clients can browse and book directly from your studio page."
        >
          <div className="space-y-5">
            {/* Enable toggle + preview count */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--nb-text)]">Enable flash gallery</p>
                <p className="text-xs text-[var(--nb-text-2)] mt-0.5">Show a flash section on your public studio page</p>
              </div>
              <button
                type="button"
                onClick={() => setFlashEnabled((v) => !v)}
                role="switch"
                aria-checked={flashEnabled}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors ${flashEnabled ? "bg-[#7C3AED]" : "bg-[var(--nb-border)]"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${flashEnabled ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>

            {flashEnabled && (
              <div>
                <label className={labelCls}>Pieces to show on studio page</label>
                <input
                  type="number"
                  min={1}
                  max={48}
                  value={flashPreviewCount}
                  onChange={(e) => setFlashPreviewCount(Math.max(1, parseInt(e.target.value) || 6))}
                  className={`${inputCls} max-w-[120px]`}
                />
              </div>
            )}

            <div className="pt-1">
              <button
                onClick={handleSaveFlashSettings}
                disabled={flashSettingsSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {flashSettingsSaving && <Loader2 size={14} className="animate-spin" />}
                {flashSettingsSaving ? "Saving…" : "Save Settings"}
              </button>
            </div>

            {/* Flash pieces list */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-[var(--nb-text)]">
                  Flash pieces
                  {flashPieces.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-[var(--nb-text-2)]">
                      ({flashPieces.length})
                    </span>
                  )}
                </p>
                <button
                  onClick={() => { setFlashModalPiece(null); setFlashModalOpen(true); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors"
                >
                  <Plus size={12} />
                  Add piece
                </button>
              </div>

              {flashLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-[var(--nb-text-2)]" />
                </div>
              ) : flashPieces.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 rounded-xl border-2 border-dashed border-[var(--nb-border)] text-center">
                  <div className="size-10 rounded-xl bg-[var(--nb-active-bg)] flex items-center justify-center mb-3">
                    <Zap size={18} className="text-[#7C3AED]" />
                  </div>
                  <p className="text-sm font-medium text-[var(--nb-text)]">No flash pieces yet</p>
                  <p className="text-xs text-[var(--nb-text-2)] mt-1">Add your first flash design to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {flashPieces.map((piece) => {
                    const STATUS_BADGE: Record<string, string> = {
                      available: "bg-emerald-50 text-emerald-700 border-emerald-200",
                      pending:   "bg-amber-50 text-amber-700 border-amber-200",
                      claimed:   "bg-violet-50 text-violet-700 border-violet-200",
                      archived:  "bg-[var(--nb-bg)] text-[var(--nb-text-2)] border-[var(--nb-border)]",
                    };
                    return (
                      <div
                        key={piece.id}
                        className="flex items-center gap-3 rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-3 py-2.5"
                      >
                        <GripVertical size={14} className="text-[var(--nb-border)] shrink-0" />

                        {piece.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={piece.image_url} alt={piece.title} className="size-10 rounded-lg object-cover shrink-0 border border-[var(--nb-border)]" />
                        ) : (
                          <div className="size-10 rounded-lg bg-[var(--nb-active-bg)] flex items-center justify-center shrink-0">
                            <Zap size={14} className="text-[#7C3AED]" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--nb-text)] truncate">{piece.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${STATUS_BADGE[piece.status] ?? ""}`}>
                              {piece.status}
                            </span>
                            {piece.price != null && (
                              <span className="text-xs text-[var(--nb-text-2)]">${piece.price}</span>
                            )}
                            {piece.repeatable && (
                              <span className="text-[10px] text-[var(--nb-text-2)]">repeatable</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setFlashModalPiece(piece); setFlashModalOpen(true); }}
                            className="size-7 flex items-center justify-center rounded-lg text-[var(--nb-text-2)] hover:text-[#7C3AED] hover:bg-[var(--nb-active-bg)] transition-colors"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteFlashPiece(piece.id)}
                            disabled={flashDeleting === piece.id}
                            className="size-7 flex items-center justify-center rounded-lg text-[var(--nb-text-2)] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {flashDeleting === piece.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        {/* ── Reviews ────────────────────────────────────────────────────── */}
        <SectionCard
          title="Reviews"
          description="Manage client reviews. Toggle which ones appear on your public studio page."
        >
          {/* Review link */}
          <div className="mb-6">
            <label className={labelCls}>Your review link</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-2.5 text-sm text-[var(--nb-text-2)] truncate select-all font-mono">
                {mounted
                  ? `${window.location.origin}/review/${slug}`
                  : `https://needlebook-crm.vercel.app/review/${slug}`}
              </div>
              <CopyReviewLinkButton slug={slug} mounted={mounted} />
            </div>
          </div>

          {/* Stats */}
          {reviews.length > 0 && (
            <div className="flex items-center gap-4 mb-5 px-4 py-3 rounded-xl bg-[var(--nb-bg)] border border-[var(--nb-border)]">
              <div className="text-center">
                <p className="text-2xl font-bold text-[var(--nb-text)]">{reviews.length}</p>
                <p className="text-xs text-[var(--nb-text-2)] mt-0.5">Total</p>
              </div>
              <div className="w-px h-8 bg-[var(--nb-border)]" />
              <div className="text-center">
                <p className="text-2xl font-bold text-[var(--nb-text)]">
                  {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}
                </p>
                <p className="text-xs text-[var(--nb-text-2)] mt-0.5">Avg rating</p>
              </div>
              <div className="w-px h-8 bg-[var(--nb-border)]" />
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">
                  {reviews.filter((r) => r.is_displayed).length}
                </p>
                <p className="text-xs text-[var(--nb-text-2)] mt-0.5">Shown</p>
              </div>
            </div>
          )}

          {/* List */}
          {reviewsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin text-[var(--nb-text-2)]" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 rounded-xl border-2 border-dashed border-[var(--nb-border)] text-center">
              <div className="size-10 rounded-xl bg-[var(--nb-bg)] flex items-center justify-center mb-3">
                <Star size={18} className="text-[var(--nb-text-2)]" />
              </div>
              <p className="text-sm font-medium text-[var(--nb-text)]">No reviews yet</p>
              <p className="text-xs text-[var(--nb-text-2)] mt-1">
                Share your review link with clients after their appointment
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => {
                const name = review.is_anonymous
                  ? "Anonymous"
                  : review.reviewer_name || "Anonymous";
                const date = new Date(review.created_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                });
                return (
                  <div
                    key={review.id}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                      review.is_displayed
                        ? "border-[#7C3AED]/20 bg-[#7C3AED]/5"
                        : "border-[var(--nb-border)] bg-[var(--nb-bg)]"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <svg key={s} width="13" height="13" viewBox="0 0 24 24" fill={s <= review.rating ? "#f59e0b" : "none"} stroke={s <= review.rating ? "#f59e0b" : "rgba(0,0,0,0.15)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          ))}
                        </div>
                        <span className="text-xs font-medium text-[var(--nb-text)]">{name}</span>
                        <span className="text-xs text-[var(--nb-text-2)]">· {date}</span>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-[var(--nb-text-2)] leading-relaxed line-clamp-3">
                          {review.comment}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleReview(review.id, review.is_displayed)}
                      disabled={reviewToggling === review.id}
                      title={review.is_displayed ? "Hide from studio page" : "Show on studio page"}
                      className={`shrink-0 mt-0.5 size-8 flex items-center justify-center rounded-lg border transition-all disabled:opacity-50 ${
                        review.is_displayed
                          ? "border-[#7C3AED]/30 bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
                          : "border-[var(--nb-border)] bg-[var(--nb-card)] text-[var(--nb-text-2)] hover:border-[#7C3AED]/40 hover:text-[#7C3AED]"
                      }`}
                    >
                      {reviewToggling === review.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Globe size={13} />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* ── Danger Zone ────────────────────────────────────────────────── */}
        <SectionCard
          title="Language & Region"
          description="Text direction and language settings for your Needlebook account."
        >
          <div className="rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-3.5 space-y-1.5">
            <p className="text-sm font-medium text-[var(--nb-text)]">Hebrew & RTL text support</p>
            <p className="text-xs text-[var(--nb-text-2)] leading-relaxed">
              Needlebook supports Hebrew text input throughout the app. All text fields automatically detect the writing direction — type in Hebrew and the text will align right-to-left automatically. No extra configuration is needed.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Danger Zone"
          description="Permanently delete your account and all associated data. This cannot be undone."
        >
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-300 text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-400 transition-colors"
            >
              Delete Account
            </button>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4">
              <p className="text-sm font-medium text-red-700 mb-3">
                Are you sure? This will permanently delete your studio, all clients, appointments, invoices, and requests.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {deleting && <Loader2 size={13} className="animate-spin" />}
                  {deleting ? "Deleting…" : "Yes, delete everything"}
                </button>
                <button
                  onClick={() => setDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg border border-[var(--nb-border)] text-sm font-medium text-[var(--nb-text-2)] hover:bg-[var(--nb-bg)] transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <Toast toast={toast} />

      <FlashPieceModal
        open={flashModalOpen}
        piece={flashModalPiece}
        userId={userId}
        sortOrder={flashPieces.length}
        onClose={() => { setFlashModalOpen(false); setFlashModalPiece(null); }}
        onSaved={handleFlashPieceSaved}
      />
    </>
  );
}
