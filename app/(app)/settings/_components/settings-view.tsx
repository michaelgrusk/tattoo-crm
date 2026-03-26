"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

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
}: {
  initialStudioName: string;
  initialSlug: string;
}) {
  const router = useRouter();

  // Studio profile
  const [studioName, setStudioName] = useState(initialStudioName);
  const [slug, setSlug] = useState(initialSlug);
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
  const intakePreview = slug.trim()
    ? `${host}/intake/${slug.trim()}`
    : `${host}/intake/your-slug`;

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
