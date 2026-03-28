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

  // Toast
  const [toast, setToast] = useState<ToastState>(null);

  // Mounted (for window.location)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
