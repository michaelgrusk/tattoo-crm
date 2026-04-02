"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, Loader2, Copy, Check, MessageCircle, Sparkles, RefreshCw, AlertTriangle, HelpCircle } from "lucide-react";
import { analyzeBrief, type AiBriefAnalysis } from "@/lib/ai/analyze-brief";
import { supabase, getUserId } from "@/lib/supabase/client";
import { useCurrency } from "@/components/currency-provider";
import { CURRENCY_OPTIONS } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { TattooRequest } from "../page";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalView = "detail" | "generate-quote" | "deposit" | "schedule";
type Working = "" | "quote" | "deposit" | "decline" | "schedule";
type QuoteTemplate = { id: string; category: string; body_text: string };
type MatchedArtist = { id: number; name: string; avatar_url: string | null };

// ─── Default quote template (fallback when no DB templates exist) ─────────────

const DEFAULT_QUOTE_TEMPLATE: QuoteTemplate = {
  id: "__default__",
  category: "quote",
  body_text: "Hi {{client_name}}! 🖋️ Thanks for reaching out to {{studio_name}}.\n\nWe'd love to work on your tattoo — {{tattoo_description}} sounds awesome, we'd love to get this going!\n\nHere's our estimated quote:\n💰 *{{total_amount}}*\n\nTo secure your spot, a deposit of {{deposit_amount}} is required.\nAccepted payment methods: BIT, Bank Transfer.\n\nWe're excited to work with you — reply if you have any questions! 🙏",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDescription(raw: string) {
  const lines = raw.split("\n");
  const structured: Record<string, string> = {};
  const descLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^(Placement|Size|Preferred date|Phone):\s*(.+)$/);
    if (match) {
      structured[match[1]] = match[2];
    } else {
      descLines.push(line);
    }
  }

  return {
    tattooDescription: descLines.join("\n").trim(),
    placement: structured["Placement"] ?? "",
    size: structured["Size"] ?? "",
    preferredDate: structured["Preferred date"] ?? "",
    phone: structured["Phone"] ?? "",
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_CFG = {
  "new request":  { dot: "bg-sky-400",    text: "text-sky-700",    bg: "bg-sky-50",    label: "New Request" },
  "quote sent":   { dot: "bg-amber-400",  text: "text-amber-700",  bg: "bg-amber-50",  label: "Quote Sent" },
  "deposit paid": { dot: "bg-emerald-400",text: "text-emerald-700",bg: "bg-emerald-50",label: "Deposit Paid" },
  "booked":       { dot: "bg-violet-400", text: "text-violet-700", bg: "bg-violet-50", label: "Booked" },
  declined:       { dot: "bg-red-400",    text: "text-red-700",    bg: "bg-red-50",    label: "Declined" },
} as const;

const APPOINTMENT_TYPES = [
  "Full session",
  "Consultation",
  "Touch-up",
  "Flash piece",
  "Sleeve session",
];

const inputCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 transition-colors";

const selectCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring transition-colors";

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-2">
      {children}
    </p>
  );
}

function DeclineButton({
  confirm,
  busy,
  working,
  onClick,
}: {
  confirm: boolean;
  busy: boolean;
  working: Working;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
        confirm
          ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
          : "bg-[var(--nb-card)] text-[var(--nb-text-2)] border-[var(--nb-border)] hover:bg-red-50 hover:text-red-600 hover:border-red-200"
      }`}
    >
      {working === "decline" && <Loader2 size={12} className="animate-spin" />}
      {confirm ? "Confirm Decline?" : "Decline"}
    </button>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = Math.round((score / 10) * 100);
  const color = score >= 8 ? "bg-emerald-500" : score >= 6 ? "bg-sky-500" : score >= 4 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--nb-text-2)]">{label}</span>
        <span className="font-semibold text-[var(--nb-text)]">{score}/10</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--nb-border)] overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const RATING_STYLES = {
  "Great fit":      { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Good fit":       { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200" },
  "Needs more info":{ bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" },
  "Low effort":     { bg: "bg-red-50",     text: "text-red-600",     border: "border-red-200" },
} as const;

// ─── Main component ───────────────────────────────────────────────────────────

export function RequestDetailModal({
  request,
  open,
  onOpenChange,
  onSuccess,
}: {
  request: TattooRequest | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: (message: string) => void;
}) {
  const { format: formatCurrency, currency } = useCurrency();
  const currencySymbol = CURRENCY_OPTIONS.find((c) => c.value === currency)?.symbol ?? "$";

  const [view, setView] = useState<ModalView>("detail");
  const [working, setWorking] = useState<Working>("");
  const [declineConfirm, setDeclineConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [matchedArtists, setMatchedArtists] = useState<MatchedArtist[]>([]);
  const [assignedArtistId, setAssignedArtistId] = useState<number | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AiBriefAnalysis | null>(null);
  const [aiAnalyzedAt, setAiAnalyzedAt] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Generate-quote form
  const [gqTotal, setGqTotal] = useState("");
  const [gqDeposit, setGqDeposit] = useState("");
  const [gqTemplates, setGqTemplates] = useState<QuoteTemplate[]>([]);
  const [gqTemplateId, setGqTemplateId] = useState<string>("");
  const [gqCopied, setGqCopied] = useState(false);
  const [clientInstagram, setClientInstagram] = useState<string | null>(null);
  const [studioName, setStudioName] = useState("");

  // Deposit form

  const [dpAmount, setDpAmount] = useState("");

  // Schedule form
  const [scDate, setScDate] = useState("");
  const [scTime, setScTime] = useState("10:00");
  const [scType, setScType] = useState("Full session");
  const [scStatus, setScStatus] = useState("confirmed");

  // Reset whenever a new request is opened
  useEffect(() => {
    if (open && request) {
      const p = parseDescription(request.description);
      setView("detail");
      setDeclineConfirm(false);
      setServerError(null);
      setWorking("");
      setGqTotal(request.quote_amount != null ? String(request.quote_amount) : "");
      setGqDeposit("");
      setGqCopied(false);
      setClientInstagram(null);
      setDpAmount(request.quote_amount != null ? String(request.quote_amount) : "");
      setScDate(p.preferredDate);
      setScTime("10:00");
      setScType("Full session");
      setScStatus("confirmed");
      setAssignedArtistId(request.artist_id ?? null);
      setAiAnalysis(request.ai_analysis ?? null);
      setAiAnalyzedAt(request.ai_analyzed_at ?? null);
      getUserId().then(async (userId) => {
        if (!userId) return;

        // Fetch matched artists, quote templates, studio name in parallel
        const [artistsRes, templatesRes, profileRes] = await Promise.all([
          request.style
            ? supabase.from("artists").select("id, name, avatar_url")
                .eq("user_id", userId).eq("is_active", true)
                .contains("styles", [request.style])
            : Promise.resolve({ data: [] }),
          supabase.from("whatsapp_templates")
            .select("id, category, body_text")
            .eq("user_id", userId)
            .eq("category", "quote"),
          supabase.from("profiles")
            .select("studio_name")
            .eq("id", userId)
            .single(),
        ]);

        setMatchedArtists((artistsRes.data as MatchedArtist[]) ?? []);
        setStudioName(profileRes.data?.studio_name ?? "");

        const dbTemplates = (templatesRes.data ?? []) as QuoteTemplate[];
        const templates = dbTemplates.length > 0 ? dbTemplates : [DEFAULT_QUOTE_TEMPLATE];
        setGqTemplates(templates);
        setGqTemplateId(templates[0].id);

        // Fetch client instagram if client_id is present
        if (request.client_id) {
          const { data: clientRow } = await supabase
            .from("clients")
            .select("instagram")
            .eq("id", request.client_id)
            .single();
          setClientInstagram(clientRow?.instagram ?? null);
        }
      });
    }
  }, [open, request?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function close() {
    setView("detail");
    setDeclineConfirm(false);
    setServerError(null);
    onOpenChange(false);
  }

  function backToDetail() {
    setView("detail");
    setServerError(null);
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  // Build live preview by substituting known variables into the template body
  const buildPreview = useCallback((bodyText: string) => {
    if (!request) return bodyText;
    const p = parseDescription(request.description);
    const totalFmt = gqTotal ? formatCurrency(parseFloat(gqTotal)) : "{{total_amount}}";
    const depositFmt = gqDeposit ? formatCurrency(parseFloat(gqDeposit)) : "{{deposit_amount}}";
    return bodyText
      .replace(/\{\{client_name\}\}/g, request.client_name)
      .replace(/\{\{studio_name\}\}/g, studioName || "{{studio_name}}")
      .replace(/\{\{tattoo_description\}\}/g, p.tattooDescription || "{{tattoo_description}}")
      .replace(/\{\{total_amount\}\}/g, totalFmt)
      .replace(/\{\{deposit_amount\}\}/g, depositFmt);
  }, [request, gqTotal, gqDeposit, studioName, formatCurrency]);

  async function handleConfirmQuote() {
    const amount = parseFloat(gqTotal);
    if (!gqTotal || isNaN(amount) || amount <= 0) {
      setServerError("A valid total amount is required");
      return;
    }
    setWorking("quote");
    setServerError(null);

    const userId = await getUserId();
    if (!userId) { setWorking(""); setServerError("Not authenticated"); return; }

    // Build final message to save alongside the quote
    const template = gqTemplates.find((t) => t.id === gqTemplateId);
    const generatedMessage = template ? buildPreview(template.body_text) : null;

    if (request!.client_id) {
      await supabase
        .from("clients")
        .update({ status: "quote_sent" })
        .eq("id", request!.client_id);
    }

    const { error: reqErr } = await supabase
      .from("tattoo_requests")
      .update({
        status: "quote sent",
        quote_amount: amount,
        generated_quote_message: generatedMessage,
      })
      .eq("id", request!.id);

    setWorking("");
    if (reqErr) { setServerError(reqErr.message); return; }
    close();
    onSuccess("Quote ready!");
  }

  async function handleCopyPreview() {
    const template = gqTemplates.find((t) => t.id === gqTemplateId);
    if (!template) return;
    await navigator.clipboard.writeText(buildPreview(template.body_text));
    setGqCopied(true);
    setTimeout(() => setGqCopied(false), 2000);
  }

  async function handleConfirmDeposit() {
    const amount = parseFloat(dpAmount);
    if (!dpAmount || isNaN(amount) || amount <= 0) {
      setServerError("A valid deposit amount is required");
      return;
    }
    setWorking("deposit");
    setServerError(null);

    const userId = await getUserId();
    if (!userId) { setWorking(""); setServerError("Not authenticated"); return; }

    const today = new Date().toISOString().split("T")[0];

    // Update client status
    if (request!.client_id) {
      await supabase
        .from("clients")
        .update({ status: "active" })
        .eq("id", request!.client_id);
    }

    // Create a deposit invoice
    const { error: invErr } = await supabase.from("invoices").insert({
      user_id: userId,
      client_id: request!.client_id,
      amount,
      status: "deposit",
      type: `Deposit — ${request!.style}`,
      date: today,
    });

    if (invErr) {
      setWorking("");
      setServerError(invErr.message);
      return;
    }

    // Update request status
    const { error: reqErr } = await supabase
      .from("tattoo_requests")
      .update({ status: "deposit paid" })
      .eq("id", request!.id);

    setWorking("");
    if (reqErr) { setServerError(reqErr.message); return; }
    close();
    onSuccess("Deposit recorded and invoice created");
  }

  async function handleDecline() {
    if (!declineConfirm) { setDeclineConfirm(true); return; }
    setWorking("decline");
    setServerError(null);
    const { error } = await supabase
      .from("tattoo_requests")
      .update({ status: "declined" })
      .eq("id", request!.id);
    setWorking("");
    if (error) { setServerError(error.message); return; }
    close();
    onSuccess("Request declined");
  }

  async function handleAssignArtist(artistId: number) {
    setAssigning(true);
    const { error } = await supabase
      .from("tattoo_requests")
      .update({ artist_id: artistId })
      .eq("id", request!.id);
    setAssigning(false);
    if (!error) setAssignedArtistId(artistId);
  }

  async function handleSchedule() {
    if (!scDate) { setServerError("Date is required"); return; }
    setWorking("schedule");
    setServerError(null);

    const userId = await getUserId();
    if (!userId) { setWorking(""); setServerError("Not authenticated"); return; }

    const { error: apptErr } = await supabase.from("appointments").insert({
      user_id: userId,
      client_id: request!.client_id ?? null,
      artist_name: request!.client_id ? null : request!.client_name,
      artist_id: assignedArtistId ?? null,
      date: scDate,
      time: scTime + ":00",
      type: scType,
      status: scStatus,
    });

    if (apptErr) { setWorking(""); setServerError(apptErr.message); return; }

    // Move request to "booked" stage and update client status
    await Promise.all([
      supabase.from("tattoo_requests").update({ status: "booked" }).eq("id", request!.id),
      request!.client_id
        ? supabase.from("clients").update({ status: "consultation_booked" }).eq("id", request!.client_id)
        : Promise.resolve(),
    ]);

    setWorking("");
    close();
    onSuccess("Appointment scheduled!");
  }

  async function handleArchive() {
    setArchiving(true);
    await supabase
      .from("tattoo_requests")
      .update({ status: "archived" })
      .eq("id", request!.id);
    setArchiving(false);
    onSuccess("Request archived");
  }

  async function runAnalysis() {
    if (!request) return;
    setAiLoading(true);
    try {
      const parsed = parseDescription(request.description);
      const analysis = analyzeBrief({
        client_name: request.client_name,
        description: request.description,
        style: request.style,
        placement: parsed.placement || null,
        size: parsed.size || null,
        preferred_date: parsed.preferredDate || null,
        has_reference_image: !!request.reference_image_url,
        has_phone: !!parsed.phone,
        has_instagram: !!clientInstagram,
        artists: matchedArtists,
      });
      const now = new Date().toISOString();
      setAiAnalysis(analysis);
      setAiAnalyzedAt(now);
      // Persist to DB (fire-and-forget, non-blocking)
      supabase
        .from("tattoo_requests")
        .update({ ai_analysis: analysis, ai_analyzed_at: now })
        .eq("id", request.id)
        .then(() => {});
    } finally {
      setAiLoading(false);
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  if (!request) return null;

  const parsed = parseDescription(request.description);
  const cfg = STATUS_CFG[request.status as keyof typeof STATUS_CFG] ?? STATUS_CFG["new request"];
  const busy = working !== "";

  const titleMap: Record<ModalView, string> = {
    "detail": "Request Details",
    "generate-quote": "Generate Quote",
    "deposit": "Record Deposit",
    "schedule": "Schedule Appointment",
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="sm:max-w-xl overflow-y-auto max-h-[92vh]">
        <DialogHeader>
          <DialogTitle>{titleMap[view]}</DialogTitle>
          <DialogDescription className="sr-only">Request details and workflow actions</DialogDescription>
        </DialogHeader>

        {/* ════════════════════════════════════════════════════
            DETAIL VIEW
        ════════════════════════════════════════════════════ */}
        {view === "detail" && (
          <div className="space-y-5 pt-1">

            {/* AI Analysis card */}
            <div className="rounded-xl border border-[var(--nb-border)] bg-[var(--nb-card)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--nb-border)] bg-[var(--nb-bg)]">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={13} className="text-[#7C3AED]" />
                  <span className="text-xs font-semibold text-[var(--nb-text)]">AI Brief Analysis</span>
                  {aiAnalysis && (() => {
                    const r = RATING_STYLES[aiAnalysis.overall_rating];
                    return (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border ${r.bg} ${r.text} ${r.border}`}>
                        {aiAnalysis.overall_rating}
                      </span>
                    );
                  })()}
                </div>
                <button
                  type="button"
                  onClick={runAnalysis}
                  disabled={aiLoading}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--nb-text-2)] hover:text-[#7C3AED] transition-colors disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  {aiAnalysis ? "Re-analyze" : "Analyze"}
                </button>
              </div>

              {aiLoading && !aiAnalysis && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-[var(--nb-text-2)]">
                  <Loader2 size={15} className="animate-spin" />
                  Analyzing brief…
                </div>
              )}

              {!aiLoading && !aiAnalysis && (
                <div className="px-4 py-4 text-center">
                  <p className="text-xs text-[var(--nb-text-2)]">No analysis yet — click Analyze to generate insights.</p>
                </div>
              )}

              {aiAnalysis && (
                <div className="px-4 py-3 space-y-3">
                  {/* Score bars */}
                  <div className="grid grid-cols-2 gap-3">
                    <ScoreBar label="Fit score" score={aiAnalysis.fit_score} />
                    <ScoreBar label="Effort score" score={aiAnalysis.effort_score} />
                  </div>

                  {/* Structured brief */}
                  <div>
                    <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-1">Brief</p>
                    <p className="text-xs text-[var(--nb-text)] leading-relaxed">{aiAnalysis.structured_brief}</p>
                  </div>

                  {/* Session + style row */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--nb-active-bg)] px-2 py-0.5 text-[#7C3AED] font-medium">
                      {aiAnalysis.session_length}
                    </span>
                    {aiAnalysis.recommended_style && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--nb-border)] px-2 py-0.5 text-[var(--nb-text-2)]">
                        Style: {aiAnalysis.recommended_style}
                      </span>
                    )}
                    {aiAnalysis.suggested_artist && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--nb-border)] px-2 py-0.5 text-[var(--nb-text-2)]">
                        Artist: {aiAnalysis.suggested_artist}
                      </span>
                    )}
                  </div>

                  {/* Red flags */}
                  {aiAnalysis.red_flags.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide flex items-center gap-1">
                        <AlertTriangle size={10} className="text-amber-500" /> Red flags
                      </p>
                      <ul className="space-y-0.5">
                        {aiAnalysis.red_flags.map((f, i) => (
                          <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                            <span className="mt-0.5 shrink-0">•</span>{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggested questions */}
                  {aiAnalysis.suggested_questions.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide flex items-center gap-1">
                        <HelpCircle size={10} className="text-sky-500" /> Ask the client
                      </p>
                      <ul className="space-y-0.5">
                        {aiAnalysis.suggested_questions.map((q, i) => (
                          <li key={i} className="text-xs text-[var(--nb-text)] flex items-start gap-1.5">
                            <span className="mt-0.5 shrink-0 text-sky-500">?</span>{q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiAnalyzedAt && (
                    <p className="text-[10px] text-[var(--nb-text-2)]">
                      Analyzed {new Date(aiAnalyzedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Client card */}
            <div className="rounded-xl border border-[var(--nb-border)] bg-[var(--nb-card)] px-4 py-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-[var(--nb-text)] truncate">
                    {request.client_name}
                  </p>
                  <p className="text-sm text-[var(--nb-text-2)] truncate">{request.client_email}</p>
                  {parsed.phone && (
                    <p className="text-sm text-[var(--nb-text-2)]">{parsed.phone}</p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shrink-0 ${cfg.text} ${cfg.bg}`}
                >
                  <span className={`size-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
              </div>
              {request.quote_amount != null && (
                <p className="text-xs text-[var(--nb-text-2)] mt-1">
                  Quote:{" "}
                  <span className="font-semibold text-[var(--nb-text)]">
                    {formatCurrency(request.quote_amount)}
                  </span>
                </p>
              )}
              <p className="text-xs text-[var(--nb-text-2)] mt-1">
                Submitted{" "}
                {new Date(request.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>

            {/* Tattoo details */}
            <div>
              <SectionLabel>Tattoo Details</SectionLabel>
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-[var(--nb-active-bg)] px-2.5 py-0.5 text-xs font-medium text-[#7C3AED]">
                    {request.style}
                  </span>
                  {parsed.placement && (
                    <span className="text-xs text-[var(--nb-text-2)]">
                      Placement: <span className="text-[var(--nb-text)] font-medium">{parsed.placement}</span>
                    </span>
                  )}
                  {parsed.size && (
                    <span className="text-xs text-[var(--nb-text-2)]">
                      Size: <span className="text-[var(--nb-text)] font-medium">{parsed.size}</span>
                    </span>
                  )}
                </div>

                {parsed.tattooDescription && (
                  <p className="text-sm text-[var(--nb-text)] leading-relaxed bg-[var(--nb-card)] rounded-lg border border-[var(--nb-card)] px-3 py-2.5">
                    {parsed.tattooDescription}
                  </p>
                )}

                {parsed.preferredDate && (
                  <p className="text-xs text-[var(--nb-text-2)]">
                    Preferred date:{" "}
                    <span className="font-medium text-[var(--nb-text)]">
                      {formatDate(parsed.preferredDate)}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Recommended artists */}
            {matchedArtists.length > 0 && (
              <div>
                <SectionLabel>Recommended Artists</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {matchedArtists.map((artist) => {
                    const isAssigned = assignedArtistId === artist.id;
                    const initials = artist.name
                      .trim()
                      .split(/\s+/)
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    return (
                      <button
                        key={artist.id}
                        type="button"
                        disabled={assigning}
                        onClick={() => handleAssignArtist(artist.id)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                          isAssigned
                            ? "bg-[var(--nb-active-bg)] text-[#7C3AED] border-[#C4B5FD]"
                            : "bg-[var(--nb-card)] text-[var(--nb-text-2)] border-[var(--nb-border)] hover:border-[#7C3AED] hover:text-[#7C3AED]"
                        }`}
                      >
                        {artist.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={artist.avatar_url} alt={artist.name} className="size-5 rounded-full object-cover" />
                        ) : (
                          <span className="size-5 rounded-full bg-[var(--nb-border)] flex items-center justify-center text-[9px] font-bold text-[var(--nb-text-2)]">
                            {initials}
                          </span>
                        )}
                        {artist.name}
                        {isAssigned && (
                          <span className="text-[10px] font-semibold text-[#7C3AED]">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reference image */}
            {request.reference_image_url && (
              <div>
                <SectionLabel>Reference Image</SectionLabel>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={request.reference_image_url}
                  alt="Reference"
                  className="w-full max-h-52 object-cover rounded-xl border border-[var(--nb-border)]"
                />
              </div>
            )}

            {/* Error */}
            {serverError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {serverError}
              </p>
            )}
            {/* Action footer */}
            <div className="border-t border-[var(--nb-border)] pt-4">

              {request.status === "new request" && (
                <div className="flex items-center justify-between gap-2">
                  <Button
                    onClick={() => setView("generate-quote")}
                    disabled={busy}
                    className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
                  >
                    Generate Quote
                  </Button>
                  <DeclineButton
                    confirm={declineConfirm}
                    busy={busy}
                    working={working}
                    onClick={handleDecline}
                  />
                </div>
              )}

              {request.status === "quote sent" && (
                <div className="flex items-center justify-between gap-2">
                  <Button
                    onClick={() => setView("deposit")}
                    disabled={busy}
                    className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
                  >
                    Mark Deposit Paid
                  </Button>
                  <DeclineButton
                    confirm={declineConfirm}
                    busy={busy}
                    working={working}
                    onClick={handleDecline}
                  />
                </div>
              )}

              {request.status === "deposit paid" && (
                <div className="flex items-center justify-between gap-2">
                  <Button
                    onClick={() => setView("schedule")}
                    disabled={busy}
                    className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
                  >
                    Schedule Appointment
                  </Button>
                  <DeclineButton
                    confirm={declineConfirm}
                    busy={busy}
                    working={working}
                    onClick={handleDecline}
                  />
                </div>
              )}

              {/* Archive — available for any active (non-archived, non-declined) request */}
              {!["archived", "declined"].includes(request.status) && (
                <div className="mt-3 pt-3 border-t border-[var(--nb-border)]">
                  <button
                    type="button"
                    onClick={handleArchive}
                    disabled={archiving || busy}
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--nb-text-2)] hover:text-amber-600 transition-colors px-2 py-1 rounded-lg hover:bg-amber-50 disabled:opacity-50"
                  >
                    {archiving && <Loader2 size={11} className="animate-spin" />}
                    Archive this request
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            GENERATE QUOTE VIEW
        ════════════════════════════════════════════════════ */}
        {view === "generate-quote" && (
          <div className="space-y-4 pt-1">
            <button
              onClick={backToDetail}
              className="inline-flex items-center gap-1 text-sm text-[var(--nb-text-2)] hover:text-[var(--nb-text)] transition-colors -ml-0.5"
            >
              <ChevronLeft size={14} />
              Back to details
            </button>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="gq-total">
                  Total ({currencySymbol}) <span className="text-[#7C3AED]">*</span>
                </Label>
                <Input
                  id="gq-total"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 600"
                  value={gqTotal}
                  onChange={(e) => setGqTotal(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gq-deposit">Deposit ({currencySymbol})</Label>
                <Input
                  id="gq-deposit"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 150"
                  value={gqDeposit}
                  onChange={(e) => setGqDeposit(e.target.value)}
                />
              </div>
            </div>

            {/* Template selector */}
            {gqTemplates.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="gq-template">Template</Label>
                <select
                  id="gq-template"
                  value={gqTemplateId}
                  onChange={(e) => setGqTemplateId(e.target.value)}
                  className={selectCls}
                >
                  {gqTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.category === "quote" ? "Quote" : t.category}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Live preview */}
            {(() => {
              const template = gqTemplates.find((t) => t.id === gqTemplateId);
              const preview = template ? buildPreview(template.body_text) : null;
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Message Preview</Label>
                    {preview && (
                      <button
                        type="button"
                        onClick={handleCopyPreview}
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                          gqCopied
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            : "bg-[var(--nb-active-bg)] text-[#7C3AED] border border-[#C4B5FD]/50 hover:bg-[#7C3AED]/10"
                        }`}
                      >
                        {gqCopied ? <Check size={11} /> : <Copy size={11} />}
                        {gqCopied ? "Copied!" : "Copy"}
                      </button>
                    )}
                  </div>
                  <div className="rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-3 max-h-52 overflow-y-auto">
                    {preview ? (
                      <p className="text-sm text-[var(--nb-text)] whitespace-pre-line leading-relaxed">
                        {preview}
                      </p>
                    ) : (
                      <p className="text-sm text-[var(--nb-text-2)] italic">
                        No template saved yet — add one in Settings → Quote Templates.
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Outreach buttons */}
            <div className="grid grid-cols-2 gap-2">
              {/* Instagram */}
              <div className="relative group">
                <button
                  type="button"
                  disabled={!clientInstagram}
                  onClick={() => {
                    if (!clientInstagram) return;
                    window.open(`https://instagram.com/${clientInstagram.replace(/^@/, "")}`, "_blank");
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--nb-border)] bg-[var(--nb-card)] px-3 py-2.5 text-sm font-medium text-[var(--nb-text-2)] hover:border-pink-300 hover:text-pink-600 hover:bg-pink-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                  Open Instagram
                </button>
                {!clientInstagram && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-[var(--nb-text)] text-[var(--nb-card)] text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    No Instagram handle on this client
                  </div>
                )}
              </div>
              {/* WhatsApp */}
              <div className="relative group">
                <button
                  type="button"
                  disabled={!parsed.phone}
                  onClick={() => {
                    if (!parsed.phone) return;
                    const digits = parsed.phone.replace(/\D/g, "");
                    window.open(`https://wa.me/${digits}`, "_blank");
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--nb-border)] bg-[var(--nb-card)] px-3 py-2.5 text-sm font-medium text-[var(--nb-text-2)] hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <MessageCircle size={15} />
                  Open WhatsApp
                </button>
                {!parsed.phone && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-[var(--nb-text)] text-[var(--nb-card)] text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    No phone number for this client
                  </div>
                )}
              </div>
            </div>

            {serverError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {serverError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--nb-border)]">
              <Button variant="outline" onClick={backToDetail} disabled={busy}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmQuote}
                disabled={busy}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5"
              >
                {working === "quote" && <Loader2 size={13} className="animate-spin" />}
                {working === "quote" ? "Saving…" : "Confirm Quote"}
              </Button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            DEPOSIT VIEW
        ════════════════════════════════════════════════════ */}
        {view === "deposit" && (
          <div className="space-y-4 pt-1">
            <button
              onClick={backToDetail}
              className="inline-flex items-center gap-1 text-sm text-[var(--nb-text-2)] hover:text-[var(--nb-text)] transition-colors -ml-0.5"
            >
              <ChevronLeft size={14} />
              Back to details
            </button>

            <p className="text-sm text-[var(--nb-text-2)] leading-relaxed">
              Record the deposit from{" "}
              <span className="font-medium text-[var(--nb-text)]">{request.client_name}</span>.
              A deposit invoice will be created automatically.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="dp-amount">
                Deposit amount ({currencySymbol}) <span className="text-[#7C3AED]">*</span>
              </Label>
              <Input
                id="dp-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 150"
                value={dpAmount}
                onChange={(e) => setDpAmount(e.target.value)}
                autoFocus
              />
              {request.quote_amount != null && (
                <p className="text-xs text-[var(--nb-text-2)]">
                  Full quote was {formatCurrency(request.quote_amount)}
                </p>
              )}
            </div>

            {serverError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {serverError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--nb-border)]">
              <Button variant="outline" onClick={backToDetail} disabled={busy}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDeposit}
                disabled={busy}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5"
              >
                {working === "deposit" && <Loader2 size={13} className="animate-spin" />}
                {working === "deposit" ? "Recording…" : "Confirm Deposit"}
              </Button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            SCHEDULE VIEW
        ════════════════════════════════════════════════════ */}
        {view === "schedule" && (
          <div className="space-y-4 pt-1">
            <button
              onClick={backToDetail}
              className="inline-flex items-center gap-1 text-sm text-[var(--nb-text-2)] hover:text-[var(--nb-text)] transition-colors -ml-0.5"
            >
              <ChevronLeft size={14} />
              Back to details
            </button>

            <p className="text-sm text-[var(--nb-text-2)]">
              Scheduling for{" "}
              <span className="font-medium text-[var(--nb-text)]">
                {request.client_name}
              </span>
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sc-date">
                  Date <span className="text-[#7C3AED]">*</span>
                </Label>
                <Input
                  id="sc-date"
                  type="date"
                  value={scDate}
                  onChange={(e) => setScDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sc-time">Time</Label>
                <input
                  id="sc-time"
                  type="time"
                  value={scTime}
                  min="09:00"
                  max="18:00"
                  onChange={(e) => setScTime(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sc-type">Type</Label>
                <select
                  id="sc-type"
                  value={scType}
                  onChange={(e) => setScType(e.target.value)}
                  className={selectCls}
                >
                  {APPOINTMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sc-status">Status</Label>
                <select
                  id="sc-status"
                  value={scStatus}
                  onChange={(e) => setScStatus(e.target.value)}
                  className={selectCls}
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            {serverError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {serverError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--nb-border)]">
              <Button variant="outline" onClick={backToDetail} disabled={busy}>
                Cancel
              </Button>
              <Button
                onClick={handleSchedule}
                disabled={busy}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5"
              >
                {working === "schedule" && <Loader2 size={13} className="animate-spin" />}
                {working === "schedule" ? "Booking…" : "Book Appointment"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
