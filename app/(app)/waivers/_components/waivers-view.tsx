"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Copy,
  Check,
  Edit2,
  Users,
  FileX,
  Eye,
  CheckCircle2,
  AlertCircle,
  X,
  PenLine,
} from "lucide-react";
import { supabase, getUserId } from "@/lib/supabase/client";
import { StudioSignModal } from "./studio-sign-modal";
import type { WaiverTemplate, SignedWaiver, WaiverSection, WaiverField } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(str: string) {
  return new Date(str).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastState = { msg: string; type: "success" | "error" } | null;

function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium animate-in slide-in-from-bottom-4 fade-in duration-200 ${
        toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
      }`}
    >
      {toast.type === "success" ? (
        <CheckCircle2 size={16} className="shrink-0" />
      ) : (
        <AlertCircle size={16} className="shrink-0" />
      )}
      {toast.msg}
    </div>
  );
}

// ─── Signed waiver detail dialog ──────────────────────────────────────────────

function fieldTypeLabel(type: string) {
  return type === "yesno" ? "Yes / No" : type === "checkbox" ? "Checkbox" : type;
}

function renderResponse(field: WaiverField, responses: Record<string, string | boolean>) {
  const val = responses[field.id];
  if (field.type === "checkbox") {
    return val ? "✓ Agreed" : "✗ Not agreed";
  }
  if (field.type === "yesno") {
    if (val === true || val === "true" || val === "yes") {
      const followUp = field.followUpLabel ? responses[field.id + "_followup"] : undefined;
      return followUp ? `Yes — ${followUp}` : "Yes";
    }
    return val === false || val === "false" || val === "no" ? "No" : String(val ?? "—");
  }
  return String(val ?? "—");
}

function SignedWaiverDialog({
  waiver,
  templates,
  onClose,
}: {
  waiver: SignedWaiver;
  templates: WaiverTemplate[];
  onClose: () => void;
}) {
  const template = templates.find((t) => t.id === waiver.template_id);
  const allFields = template?.sections.flatMap((s: WaiverSection) => s.fields) ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-[var(--nb-card)] rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--nb-border)] shrink-0">
          <div>
            <h3 className="text-base font-semibold text-[var(--nb-text)]">
              Signed Waiver
            </h3>
            <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
              {waiver.waiver_templates?.name ?? "Unknown template"} ·{" "}
              {formatDate(waiver.signed_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-[var(--nb-bg)] transition-colors text-[var(--nb-text-2)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Client info */}
          <div className="rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-3 space-y-2">
            <p className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">
              Client
            </p>
            <div className="text-sm text-[var(--nb-text)] font-medium">
              {waiver.client_name}
            </div>
            {waiver.client_email && (
              <div className="text-xs text-[var(--nb-text-2)]">{waiver.client_email}</div>
            )}
          </div>

          {/* Responses */}
          {allFields.length > 0 ? (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">
                Responses
              </p>
              {allFields.map((field: WaiverField) => (
                <div key={field.id} className="text-sm">
                  <p className="text-[var(--nb-text-2)] mb-0.5">{field.label}</p>
                  <p className="text-[var(--nb-text)] font-medium">
                    {renderResponse(field, waiver.responses)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">
                Responses
              </p>
              {Object.entries(waiver.responses).map(([key, val]) => (
                <div key={key} className="text-sm">
                  <p className="text-[var(--nb-text-2)] mb-0.5 capitalize">
                    {key.replace(/_/g, " ")}
                  </p>
                  <p className="text-[var(--nb-text)] font-medium">{String(val)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Signature */}
          {waiver.signature_data && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">
                Signature
              </p>
              {waiver.signature_type === "draw" || waiver.signature_type === "drawn" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={waiver.signature_data}
                  alt="Signature"
                  className="border border-[var(--nb-border)] rounded-lg bg-white max-h-24 object-contain"
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

// ─── Templates tab ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  sigCount,
  copied,
  onCopy,
  onToggleActive,
  onViewSigs,
  onSignNow,
}: {
  template: WaiverTemplate;
  sigCount: number;
  copied: boolean;
  onCopy: () => void;
  onToggleActive: () => void;
  onViewSigs: () => void;
  onSignNow: () => void;
}) {
  return (
    <div className="bg-[var(--nb-card)] rounded-2xl border border-[var(--nb-border)] overflow-hidden shadow-sm">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold text-[var(--nb-text)] leading-snug">
            {template.name}
          </h3>
          <button
            onClick={onToggleActive}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
              template.is_active
                ? "bg-emerald-50 text-emerald-700"
                : "bg-[var(--nb-bg)] text-[var(--nb-text-2)]"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                template.is_active ? "bg-emerald-400" : "bg-[var(--nb-text-2)]"
              }`}
            />
            {template.is_active ? "Active" : "Inactive"}
          </button>
        </div>
        <p className="text-xs text-[var(--nb-text-2)]">
          {sigCount} signature{sigCount !== 1 ? "s" : ""} · Created{" "}
          {formatDate(template.created_at)}
        </p>
      </div>

      <div className="px-5 py-3 border-t border-[var(--nb-border)] flex items-center gap-2">
        <Link
          href={`/waivers/builder/${template.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--nb-text-2)] bg-[var(--nb-bg)] border border-[var(--nb-border)] hover:text-[var(--nb-text)] transition-colors"
        >
          <Edit2 size={11} />
          Edit
        </Link>
        <button
          onClick={onCopy}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            copied
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "text-[var(--nb-text-2)] bg-[var(--nb-bg)] border-[var(--nb-border)] hover:text-[var(--nb-text)]"
          }`}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "Copied!" : "Share link"}
        </button>
        <button
          onClick={onViewSigs}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--nb-text-2)] bg-[var(--nb-bg)] border border-[var(--nb-border)] hover:text-[var(--nb-text)] transition-colors"
        >
          <Users size={11} />
          {sigCount} Sig{sigCount !== 1 ? "s" : ""}
        </button>
        <button
          onClick={onSignNow}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-[#7C3AED] hover:bg-[#6D28D9] transition-colors ml-auto"
        >
          <PenLine size={11} />
          Sign Now
        </button>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function WaiversView({
  templates: initialTemplates,
  signedWaivers,
}: {
  templates: WaiverTemplate[];
  signedWaivers: SignedWaiver[];
}) {
  const [tab, setTab] = useState<"templates" | "signed">("templates");
  const [templates, setTemplates] = useState(initialTemplates);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [selectedSigned, setSelectedSigned] = useState<SignedWaiver | null>(null);
  const [studioSignTemplate, setStudioSignTemplate] = useState<WaiverTemplate | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    getUserId().then((id) => setUserId(id ?? null));
  }, []);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // Count signatures per template
  const sigCounts: Record<number, number> = {};
  signedWaivers.forEach((sw) => {
    sigCounts[sw.template_id] = (sigCounts[sw.template_id] ?? 0) + 1;
  });

  async function handleCopy(templateId: number) {
    const url = `${window.location.origin}/waiver/sign/${templateId}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(templateId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleToggleActive(template: WaiverTemplate) {
    const next = !template.is_active;
    const { error } = await supabase
      .from("waiver_templates")
      .update({ is_active: next })
      .eq("id", template.id);
    if (error) {
      showToast(error.message, "error");
    } else {
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, is_active: next } : t))
      );
    }
  }

  return (
    <>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--nb-text)]">Waivers</h1>
            <p className="mt-1 text-sm text-[var(--nb-text-2)]">
              Manage consent forms and client signatures
            </p>
          </div>
          {tab === "templates" && (
            <Link
              href="/waivers/builder/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium transition-colors"
            >
              <Plus size={15} />
              New Template
            </Link>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] p-1 w-fit">
          {(["templates", "signed"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-[#7C3AED] text-white"
                  : "text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
              }`}
            >
              {t === "templates" ? "Templates" : "Signed Waivers"}
              <span
                className={`ml-2 text-xs rounded-full px-1.5 py-0.5 ${
                  tab === t
                    ? "bg-white/20 text-white"
                    : "bg-[var(--nb-border)] text-[var(--nb-text-2)]"
                }`}
              >
                {t === "templates" ? templates.length : signedWaivers.length}
              </span>
            </button>
          ))}
        </div>

        {/* ── Templates tab ─────────────────────────────────────────────── */}
        {tab === "templates" && (
          <>
            {templates.length === 0 ? (
              <div className="py-16 flex flex-col items-center text-center bg-[var(--nb-card)] rounded-2xl border border-[var(--nb-border)]">
                <FileX size={32} className="text-[var(--nb-border)] mb-3" />
                <p className="text-sm font-medium text-[var(--nb-text-2)]">
                  No templates yet
                </p>
                <p className="text-xs text-[var(--nb-text-2)] mt-1 mb-4">
                  Create your first waiver template
                </p>
                <Link
                  href="/waivers/builder/new"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium transition-colors"
                >
                  <Plus size={14} />
                  New Template
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    sigCount={sigCounts[t.id] ?? 0}
                    copied={copiedId === t.id}
                    onCopy={() => handleCopy(t.id)}
                    onToggleActive={() => handleToggleActive(t)}
                    onViewSigs={() => setTab("signed")}
                    onSignNow={() => setStudioSignTemplate(t)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Signed waivers tab ─────────────────────────────────────────── */}
        {tab === "signed" && (
          <div className="bg-[var(--nb-card)] rounded-2xl border border-[var(--nb-border)] shadow-sm overflow-hidden">
            {signedWaivers.length === 0 ? (
              <div className="py-16 flex flex-col items-center text-center">
                <FileX size={32} className="text-[var(--nb-border)] mb-3" />
                <p className="text-sm font-medium text-[var(--nb-text-2)]">
                  No signed waivers yet
                </p>
                <p className="text-xs text-[var(--nb-text-2)] mt-1">
                  Signed waivers will appear here once clients submit them
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--nb-border)]">
                    {["Client", "Template", "Date signed", ""].map((col, i) => (
                      <th
                        key={i}
                        className={`px-5 py-3 text-xs font-semibold text-[var(--nb-text-2)] uppercase tracking-wide ${
                          i === 3 ? "text-right" : "text-left"
                        }`}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--nb-border)]">
                  {signedWaivers.map((sw) => (
                    <tr key={sw.id} className="hover:bg-[var(--nb-bg)] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-[var(--nb-text)]">
                          {sw.client_name}
                        </p>
                        {sw.client_email && (
                          <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                            {sw.client_email}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-[var(--nb-text-2)]">
                        {sw.waiver_templates?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3.5 text-[var(--nb-text-2)] whitespace-nowrap">
                        {formatDate(sw.signed_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedSigned(sw)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--nb-text-2)] bg-[var(--nb-bg)] border border-[var(--nb-border)] hover:text-[var(--nb-text)] transition-colors"
                        >
                          <Eye size={12} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {selectedSigned && (
        <SignedWaiverDialog
          waiver={selectedSigned}
          templates={templates}
          onClose={() => setSelectedSigned(null)}
        />
      )}

      {studioSignTemplate && userId && (
        <StudioSignModal
          template={studioSignTemplate}
          userId={userId}
          onClose={() => setStudioSignTemplate(null)}
          onSigned={() => {
            showToast("Waiver signed successfully!");
            setStudioSignTemplate(null);
          }}
        />
      )}

      <Toast toast={toast} />
    </>
  );
}
