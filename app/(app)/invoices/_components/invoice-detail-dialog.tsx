"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Invoice } from "../page";
import { useCurrency } from "@/components/currency-provider";

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  Invoice["status"],
  { dot: string; text: string; bg: string; label: string }
> = {
  paid: {
    dot: "bg-emerald-400",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    label: "Paid",
  },
  pending: {
    dot: "bg-amber-400",
    text: "text-amber-700",
    bg: "bg-amber-50",
    label: "Pending",
  },
  overdue: {
    dot: "bg-red-400",
    text: "text-red-700",
    bg: "bg-red-50",
    label: "Overdue",
  },
  deposit: {
    dot: "bg-sky-400",
    text: "text-sky-700",
    bg: "bg-sky-50",
    label: "Deposit",
  },
};

const STATUS_BUTTONS: { value: Invoice["status"]; label: string }[] = [
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "overdue", label: "Overdue" },
  { value: "deposit", label: "Deposit" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function invoiceNumber(id: string | number) {
  return `#${String(id).padStart(4, "0")}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InvoiceDetailDialog({
  invoice,
  open,
  onOpenChange,
  onStatusChanged,
  onDeleted,
}: {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onStatusChanged: (toast: string) => void;
  onDeleted: () => void;
}) {
  const { format } = useCurrency();
  const [currentStatus, setCurrentStatus] = useState<Invoice["status"] | null>(null);
  const [updating, setUpdating] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Derive the displayed status: optimistic local override, or fall back to invoice data
  const displayStatus = (currentStatus ?? invoice?.status) as Invoice["status"] | undefined;
  const cfg = displayStatus ? STATUS_CONFIG[displayStatus] : undefined;

  async function handleStatusChange(newStatus: Invoice["status"]) {
    if (!invoice || newStatus === displayStatus) return;

    setUpdating(true);
    setServerError(null);

    const { error } = await supabase
      .from("invoices")
      .update({ status: newStatus })
      .eq("id", invoice.id);

    setUpdating(false);

    if (error) {
      setServerError(error.message);
      return;
    }

    // Optimistic update so the badge flips instantly
    setCurrentStatus(newStatus);
    // Trigger parent refresh + toast
    onStatusChanged(`Status updated to ${STATUS_CONFIG[newStatus].label}`);
  }

  function handleOpenChange(v: boolean) {
    if (!v) {
      setCurrentStatus(null);
      setServerError(null);
      setDeleteConfirm(false);
      setDeleting(false);
    }
    onOpenChange(v);
  }

  async function handleDelete() {
    if (!invoice) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setDeleting(true);
    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", invoice.id);
    setDeleting(false);
    if (error) {
      setServerError(error.message);
      setDeleteConfirm(false);
      return;
    }
    handleOpenChange(false);
    onDeleted();
  }

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invoice {invoiceNumber(invoice.id)}</DialogTitle>
          <DialogDescription className="sr-only">Invoice details and status</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Invoice meta */}
          <div className="rounded-xl border border-[var(--nb-border)] bg-[var(--nb-card)] px-4 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">
                  Invoice
                </p>
                <p className="text-sm font-medium text-[var(--nb-text)]">
                  {invoiceNumber(invoice.id)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">
                  Date
                </p>
                <p className="text-sm text-[var(--nb-text)]">{formatDate(invoice.date)}</p>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">
                Client
              </p>
              <p className="text-sm font-medium text-[var(--nb-text)]">
                {invoice.clients?.name ?? "—"}
              </p>
              {invoice.clients?.email && (
                <p className="text-xs text-[var(--nb-text-2)] mt-0.5">{invoice.clients.email}</p>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">
                Description
              </p>
              <p className="text-sm text-[var(--nb-text)]" dir="auto">{invoice.type || "—"}</p>
            </div>

            {invoice.tattoo_requests && (
              <div className="flex items-start gap-2.5 rounded-lg bg-[var(--nb-active-bg)] border border-[#7C3AED]/15 px-3 py-2.5">
                <svg width="14" height="14" className="shrink-0 mt-0.5 text-[#7C3AED]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-[#7C3AED] uppercase tracking-wide mb-0.5">Linked Request</p>
                  <p className="text-xs text-[var(--nb-text)] leading-snug truncate">{invoice.tattoo_requests.description.split("\n")[0]}</p>
                  <p className="text-[11px] text-[var(--nb-text-2)] mt-0.5">{invoice.tattoo_requests.style}</p>
                </div>
              </div>
            )}

            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">
                  Amount
                </p>
                <p className="text-2xl font-semibold text-[var(--nb-text)] leading-none">
                  {format(invoice.amount)}
                </p>
              </div>
              {cfg && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.text} ${cfg.bg}`}
                >
                  <span className={`size-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
              )}
            </div>
          </div>

          {/* Change status */}
          <div>
            <p className="text-xs font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-2">
              Change Status
            </p>
            <div className="grid grid-cols-4 gap-2">
              {STATUS_BUTTONS.map(({ value, label }) => {
                const isActive = value === displayStatus;
                const scfg = STATUS_CONFIG[value];
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={updating}
                    onClick={() => handleStatusChange(value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs font-medium transition-all disabled:opacity-50 ${
                      isActive
                        ? `${scfg.bg} ${scfg.text} border-current ring-2 ring-current/20`
                        : "bg-[var(--nb-card)] text-[var(--nb-text-2)] border-[var(--nb-border)] hover:bg-[var(--nb-bg)] hover:text-[var(--nb-text)]"
                    }`}
                  >
                    <span className={`size-2 rounded-full ${isActive ? scfg.dot : "bg-[var(--nb-border)]"}`} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {updating && (
            <div className="flex items-center gap-2 text-xs text-[var(--nb-text-2)]">
              <Loader2 size={12} className="animate-spin" />
              Updating…
            </div>
          )}

          {serverError && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {serverError}
            </p>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || updating}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
              deleteConfirm
                ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                : "bg-[var(--nb-card)] text-[var(--nb-text-2)] border-[var(--nb-border)] hover:bg-red-50 hover:text-red-600 hover:border-red-200"
            }`}
          >
            {deleting && <Loader2 size={12} className="animate-spin" />}
            {deleteConfirm ? "Confirm Delete?" : "Delete Invoice"}
          </button>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
