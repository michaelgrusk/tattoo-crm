"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { supabase, getUserId } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TattooRequest } from "../page";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalView = "detail" | "send-quote" | "deposit" | "schedule";
type Working = "" | "quote" | "deposit" | "decline" | "schedule";

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
  "new request": { dot: "bg-sky-400", text: "text-sky-700", bg: "bg-sky-50", label: "New Request" },
  "quote sent": { dot: "bg-amber-400", text: "text-amber-700", bg: "bg-amber-50", label: "Quote Sent" },
  "deposit paid": { dot: "bg-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50", label: "Deposit Paid" },
  declined: { dot: "bg-red-400", text: "text-red-700", bg: "bg-red-50", label: "Declined" },
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
  const [view, setView] = useState<ModalView>("detail");
  const [working, setWorking] = useState<Working>("");
  const [declineConfirm, setDeclineConfirm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Send-quote form
  const [sqAmount, setSqAmount] = useState("");
  const [sqNote, setSqNote] = useState("");

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
      setSqAmount(request.quote_amount != null ? String(request.quote_amount) : "");
      setSqNote("");
      setDpAmount(request.quote_amount != null ? String(request.quote_amount) : "");
      setScDate(p.preferredDate);
      setScTime("10:00");
      setScType("Full session");
      setScStatus("confirmed");
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

  async function handleSendQuote() {
    const amount = parseFloat(sqAmount);
    if (!sqAmount || isNaN(amount) || amount <= 0) {
      setServerError("A valid quote amount is required");
      return;
    }
    setWorking("quote");
    setServerError(null);

    const userId = await getUserId();
    if (!userId) { setWorking(""); setServerError("Not authenticated"); return; }

    const parsed = parseDescription(request!.description);

    // Create a client record if one doesn't exist yet
    let clientId = request!.client_id;
    if (!clientId) {
      const { data: clientData, error: clientErr } = await supabase
        .from("clients")
        .insert({
          user_id: userId,
          name: request!.client_name,
          email: request!.client_email,
          phone: parsed.phone || null,
          notes: `Created from tattoo request · ${request!.style}`,
        })
        .select("id")
        .single();

      if (clientErr) {
        setWorking("");
        setServerError(clientErr.message);
        return;
      }
      clientId = clientData.id;
    }

    // Update the request
    const { error: reqErr } = await supabase
      .from("tattoo_requests")
      .update({
        status: "quote sent",
        quote_amount: amount,
        client_id: clientId,
      })
      .eq("id", request!.id);

    setWorking("");
    if (reqErr) { setServerError(reqErr.message); return; }
    close();
    onSuccess("Quote sent! Client added to Contacts.");
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
      date: scDate,
      time: scTime + ":00",
      type: scType,
      status: scStatus,
    });

    setWorking("");
    if (apptErr) { setServerError(apptErr.message); return; }
    close();
    onSuccess("Appointment scheduled!");
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  if (!request) return null;

  const parsed = parseDescription(request.description);
  const cfg = STATUS_CFG[request.status as keyof typeof STATUS_CFG] ?? STATUS_CFG["new request"];
  const busy = working !== "";

  const titleMap: Record<ModalView, string> = {
    "detail": "Request Details",
    "send-quote": "Send Quote",
    "deposit": "Record Deposit",
    "schedule": "Schedule Appointment",
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="sm:max-w-xl overflow-y-auto max-h-[92vh]">
        <DialogHeader>
          <DialogTitle>{titleMap[view]}</DialogTitle>
        </DialogHeader>

        {/* ════════════════════════════════════════════════════
            DETAIL VIEW
        ════════════════════════════════════════════════════ */}
        {view === "detail" && (
          <div className="space-y-5 pt-1">

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
                    ${request.quote_amount.toLocaleString()}
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
                    onClick={() => setView("send-quote")}
                    disabled={busy}
                    className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
                  >
                    Send Quote
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
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            SEND QUOTE VIEW
        ════════════════════════════════════════════════════ */}
        {view === "send-quote" && (
          <div className="space-y-4 pt-1">
            <button
              onClick={backToDetail}
              className="inline-flex items-center gap-1 text-sm text-[var(--nb-text-2)] hover:text-[var(--nb-text)] transition-colors -ml-0.5"
            >
              <ChevronLeft size={14} />
              Back to details
            </button>

            <p className="text-sm text-[var(--nb-text-2)] leading-relaxed">
              Set a quote for{" "}
              <span className="font-medium text-[var(--nb-text)]">{request.client_name}</span>.
              A contact record will be created automatically.
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sq-amount">
                  Quote amount ($) <span className="text-[#7C3AED]">*</span>
                </Label>
                <Input
                  id="sq-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 450"
                  value={sqAmount}
                  onChange={(e) => setSqAmount(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sq-note">Note to client (optional)</Label>
                <textarea
                  id="sq-note"
                  rows={3}
                  placeholder="Any notes about the quote…"
                  value={sqNote}
                  onChange={(e) => setSqNote(e.target.value)}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 transition-colors resize-none placeholder:text-muted-foreground"
                />
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
                onClick={handleSendQuote}
                disabled={busy}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5"
              >
                {working === "quote" && <Loader2 size={13} className="animate-spin" />}
                {working === "quote" ? "Sending…" : "Confirm & Send Quote"}
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
                Deposit amount ($) <span className="text-[#7C3AED]">*</span>
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
                  Full quote was ${request.quote_amount.toLocaleString()}
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
