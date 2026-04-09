"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import {
  fetchAllProfiles,
  approveUser,
  rejectUser,
  type AdminProfile,
} from "../_actions";

type Tab = "pending" | "approved" | "rejected";

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function AdminView() {
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllProfiles().then((data) => {
      setProfiles(data);
      setLoading(false);
    });
  }, []);

  const pending = profiles.filter((p) => p.approval_status === "pending");
  const approved = profiles.filter((p) => p.approval_status === "approved");
  const rejected = profiles.filter((p) => p.approval_status === "rejected");

  const tabCounts: Record<Tab, number> = {
    pending: pending.length,
    approved: approved.length,
    rejected: rejected.length,
  };

  const tabData: Record<Tab, AdminProfile[]> = { pending, approved, rejected };

  async function handleApprove(profile: AdminProfile) {
    setProcessing(profile.id);
    setActionError(null);
    const { error } = await approveUser(profile.id, profile.email, profile.studio_name ?? "");
    if (error) { setActionError(error); setProcessing(null); return; }
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === profile.id
          ? { ...p, approval_status: "approved", approved_at: new Date().toISOString() }
          : p
      )
    );
    setProcessing(null);
  }

  async function handleRejectConfirm(profileId: string) {
    setProcessing(profileId);
    setActionError(null);
    const { error } = await rejectUser(profileId, rejectReason);
    if (error) { setActionError(error); setProcessing(null); return; }
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === profileId
          ? {
              ...p,
              approval_status: "rejected",
              rejected_at: new Date().toISOString(),
              rejection_reason: rejectReason.trim() || null,
            }
          : p
      )
    );
    setRejectingId(null);
    setRejectReason("");
    setProcessing(null);
  }

  const TABS: { key: Tab; label: string; color: string }[] = [
    { key: "pending", label: "Pending", color: "text-amber-600" },
    { key: "approved", label: "Approved", color: "text-emerald-600" },
    { key: "rejected", label: "Rejected", color: "text-red-600" },
  ];

  return (
    <div className="min-h-screen bg-[var(--nb-bg)] p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--nb-text)]">Admin — Beta Approvals</h1>
          <p className="text-sm text-[var(--nb-text-2)] mt-1">Manage who gets access to Needlebook</p>
        </div>

        {actionError && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {actionError}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-[var(--nb-card)] border border-[var(--nb-border)] rounded-xl p-1 mb-6">
          {TABS.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === key
                  ? "bg-[var(--nb-bg)] text-[var(--nb-text)] shadow-sm"
                  : "text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
              }`}
            >
              {label}
              {tabCounts[key] > 0 && (
                <span className={`text-xs font-bold ${tab === key ? color : "text-[var(--nb-text-2)]"}`}>
                  {tabCounts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-[var(--nb-text-2)]" />
          </div>
        ) : tabData[tab].length === 0 ? (
          <div className="text-center py-16 text-[var(--nb-text-2)] text-sm">
            No {tab} users
          </div>
        ) : (
          <div className="space-y-3">
            {tabData[tab].map((profile) => (
              <div
                key={profile.id}
                className="bg-[var(--nb-card)] border border-[var(--nb-border)] rounded-2xl px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--nb-text)] truncate">
                      {profile.studio_name || "(no studio name)"}
                    </p>
                    <p className="text-xs text-[var(--nb-text-2)] mt-0.5 truncate">{profile.email}</p>
                    <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                      {tab === "approved" && profile.approved_at
                        ? `Approved ${fmt(profile.approved_at)}`
                        : tab === "rejected" && profile.rejected_at
                        ? `Rejected ${fmt(profile.rejected_at)}`
                        : `Signed up ${fmt(profile.created_at)}`}
                    </p>
                    {tab === "rejected" && profile.rejection_reason && (
                      <p className="text-xs text-red-500 mt-1 italic">
                        Reason: {profile.rejection_reason}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {tab === "pending" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(profile)}
                        disabled={!!processing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-60"
                      >
                        {processing === profile.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={11} />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(rejectingId === profile.id ? null : profile.id);
                          setRejectReason("");
                        }}
                        disabled={!!processing}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors disabled:opacity-60"
                      >
                        <XCircle size={11} />
                        Reject
                        {rejectingId === profile.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Reject reason form */}
                {tab === "pending" && rejectingId === profile.id && (
                  <div className="mt-3 pt-3 border-t border-[var(--nb-border)] space-y-2">
                    <input
                      type="text"
                      placeholder="Rejection reason (optional)"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full rounded-lg border border-[var(--nb-border)] bg-[var(--nb-bg)] px-3 py-2 text-xs text-[var(--nb-text)] outline-none placeholder:text-[var(--nb-text-2)] focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRejectConfirm(profile.id)}
                        disabled={!!processing}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-60 flex items-center gap-1.5"
                      >
                        {processing === profile.id && <Loader2 size={11} className="animate-spin" />}
                        Confirm rejection
                      </button>
                      <button
                        onClick={() => { setRejectingId(null); setRejectReason(""); }}
                        className="px-3 py-1.5 rounded-lg border border-[var(--nb-border)] text-xs text-[var(--nb-text-2)] hover:bg-[var(--nb-bg)] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
