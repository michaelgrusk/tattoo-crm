"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { CURRENCY_OPTIONS, formatCurrency } from "@/lib/currency";
import type { CurrencyCode } from "@/lib/currency";
import { Calendar, Copy, CheckCircle2 as CopyCheck, ExternalLink } from "lucide-react";

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

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsView({
  initialStudioName,
  initialSlug,
  initialCurrency,
}: {
  initialStudioName: string;
  initialSlug: string;
  initialCurrency: string;
}) {
  const router = useRouter();

  // Studio profile
  const [studioName, setStudioName] = useState(initialStudioName);
  const [slug, setSlug] = useState(initialSlug);

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

  // WhatsApp
  const [waTestMode, setWaTestMode] = useState(false);
  const [waTestModeSaving, setWaTestModeSaving] = useState(false);
  const [waConnected] = useState(false); // will be fetched from whatsapp_connections

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

  // Load whatsapp_test_mode from profiles
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("whatsapp_test_mode, ai_auto_analyze")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.whatsapp_test_mode != null) setWaTestMode(data.whatsapp_test_mode);
          if (data?.ai_auto_analyze != null) setAiAutoAnalyze(data.ai_auto_analyze);
        });
    });
  }, []);

  async function handleWaTestModeToggle() {
    const next = !waTestMode;
    setWaTestMode(next);
    setWaTestModeSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ whatsapp_test_mode: next })
        .eq("id", user.id);
    }
    setWaTestModeSaving(false);
  }

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
        .in("category", ["quote", "deposit_followup", "aftercare"]);
      if (data && data.length > 0) {
        const loaded: Record<string, string> = {};
        for (const row of data) if (row.body_text) loaded[row.category] = row.body_text;
        setQtBodies((prev) => ({ ...prev, ...loaded }));
      }
    });
  }, []);

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

        {/* ── WhatsApp Business ──────────────────────────────────────────── */}
        <SectionCard
          title="WhatsApp Business"
          description="Connect your WhatsApp Business account to send quotes, reminders, and aftercare messages directly from Needlebook."
        >
          <div className="space-y-5">
            {/* Connection status */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`size-2.5 rounded-full shrink-0 ${waConnected ? "bg-emerald-400" : "bg-[var(--nb-border)]"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--nb-text)]">
                    {waConnected ? "Connected" : "Not connected"}
                  </p>
                  <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                    {waConnected ? "Your WhatsApp Business number is active" : "No WhatsApp Business account linked"}
                  </p>
                </div>
              </div>
              <div className="relative group shrink-0">
                <button
                  disabled
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[#7C3AED]/10 text-[#7C3AED] border border-[#7C3AED]/20 opacity-60 cursor-not-allowed"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Connect WhatsApp Business
                </button>
                <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 rounded-lg bg-[var(--nb-text)] text-[var(--nb-card)] text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Meta Business verification required — coming soon
                </div>
              </div>
            </div>

            {/* Test Mode toggle */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-[var(--nb-text)]">Test Mode</p>
                <p className="text-xs text-[var(--nb-text-2)] mt-0.5">Use Meta&apos;s test number during development</p>
              </div>
              <button
                onClick={handleWaTestModeToggle}
                disabled={waTestModeSaving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 disabled:opacity-60 ${
                  waTestMode ? "bg-[#7C3AED]" : "bg-[var(--nb-border)]"
                }`}
                role="switch"
                aria-checked={waTestMode}
              >
                <span
                  className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
                    waTestMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
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

        {/* ── Danger Zone ────────────────────────────────────────────────── */}
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
    </>
  );
}
