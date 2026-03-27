"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  TrendingUp,
  Clock,
  Landmark,
  Eye,
  BellRing,
  CheckCircle2,
  FileX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Invoice, InvoiceSummary } from "../page";
import { NewInvoiceDialog } from "./new-invoice-dialog";
import { InvoiceDetailDialog } from "./invoice-detail-dialog";
import { useCurrency } from "@/components/currency-provider";

// ─── Types ────────────────────────────────────────────────────────────────────

type Filter = "all" | "paid" | "pending" | "deposit" | "overdue";

// ─── Config ───────────────────────────────────────────────────────────────────

const FILTERS: { value: Filter; label: string; count?: number }[] = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "overdue", label: "Overdue" },
  { value: "deposit", label: "Deposit" },
];

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
  deposit: {
    dot: "bg-sky-400",
    text: "text-sky-700",
    bg: "bg-sky-50",
    label: "Deposit",
  },
  overdue: {
    dot: "bg-red-400",
    text: "text-red-700",
    bg: "bg-red-50",
    label: "Overdue",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function invoiceNumber(id: string | number) {
  return `#${String(id).padStart(4, "0")}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] px-6 py-5 flex items-center gap-4 shadow-sm">
      <div
        className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}
      >
        <Icon size={20} className={iconColor} />
      </div>
      <div>
        <p className="text-xs font-medium text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">
          {label}
        </p>
        <p className="text-2xl font-semibold text-[var(--nb-text)] leading-none">
          {value}
        </p>
        {sub && <p className="text-xs text-[var(--nb-text-2)] mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function RemindButton() {
  return (
    <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors">
      <BellRing size={12} />
      Remind
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InvoicesView({
  invoices,
  summary,
}: {
  invoices: Invoice[];
  summary: InvoiceSummary;
}) {
  const router = useRouter();
  const { format } = useCurrency();
  const [filter, setFilter] = useState<Filter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const filtered =
    filter === "all" ? invoices : invoices.filter((inv) => inv.status === filter);

  // Per-filter counts for the filter pills
  const counts: Record<Filter, number> = {
    all: invoices.length,
    paid: invoices.filter((i) => i.status === "paid").length,
    pending: invoices.filter((i) => i.status === "pending").length,
    overdue: invoices.filter((i) => i.status === "overdue").length,
    deposit: invoices.filter((i) => i.status === "deposit").length,
  };

  function showSuccessToast(message: string) {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  }

  function handleInvoiceCreated() {
    router.refresh();
    showSuccessToast("Invoice created!");
  }

  function handleStatusChanged(message: string) {
    router.refresh();
    showSuccessToast(message);
  }

  function handleInvoiceDeleted() {
    setSelectedInvoice(null);
    router.refresh();
    showSuccessToast("Invoice deleted");
  }

  // Current month name for the summary card subtitle
  const monthName = new Date().toLocaleDateString("en-US", { month: "long" });

  return (
    <>
    <div className="p-4 md:p-8 space-y-7">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--nb-text)]">Invoices</h1>
          <p className="mt-1 text-sm text-[var(--nb-text-2)]">
            Track payments and outstanding balances
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-1.5"
        >
          <Plus size={15} />
          New Invoice
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
        <SummaryCard
          label={`Revenue — ${monthName}`}
          value={format(summary.totalThisMonth)}
          sub="From paid invoices this month"
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <SummaryCard
          label="Outstanding"
          value={format(summary.outstanding)}
          sub={`${counts.pending} unpaid invoice${counts.pending !== 1 ? "s" : ""}`}
          icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <SummaryCard
          label="Deposits Held"
          value={format(summary.depositsHeld)}
          sub={`${counts.deposit} deposit${counts.deposit !== 1 ? "s" : ""} on file`}
          icon={Landmark}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
        />
      </div>

      {/* Filter + table */}
      <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="flex items-center gap-1 px-4 py-3 border-b border-[var(--nb-border)]">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === value
                  ? "bg-[#7C3AED] text-white"
                  : "text-[var(--nb-text-2)] hover:bg-[var(--nb-bg)] hover:text-[var(--nb-text)]"
              }`}
            >
              {label}
              <span
                className={`text-xs rounded-full px-1.5 py-0.5 leading-none ${
                  filter === value
                    ? "bg-white/20 text-white"
                    : "bg-[var(--nb-border)] text-[var(--nb-text-2)]"
                }`}
              >
                {counts[value]}
              </span>
            </button>
          ))}
        </div>

        {/* Table — horizontally scrollable on mobile */}
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center">
            <FileX size={32} className="text-[var(--nb-border)] mb-3" />
            <p className="text-sm font-medium text-[var(--nb-text-2)]">No invoices found</p>
            <p className="text-xs text-[var(--nb-text-2)] mt-1">
              {filter === "all" ? "Create your first invoice above" : `No ${filter} invoices`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--nb-border)] bg-[var(--nb-card)]">
                {[
                  "Invoice",
                  "Client",
                  "Description",
                  "Date",
                  "Amount",
                  "Status",
                  "",
                ].map((col, i) => (
                  <th
                    key={i}
                    className={`px-5 py-3 text-xs font-semibold text-[var(--nb-text-2)] uppercase tracking-wide ${
                      i === 0 || i === 4 || i === 5 || i === 6
                        ? "text-right"
                        : "text-left"
                    } ${i === 4 ? "tabular-nums" : ""}`}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--nb-card)]">
              {filtered.map((inv) => {
                const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.pending;
                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-[var(--nb-card)] transition-colors group"
                  >
                    {/* Invoice # */}
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-mono text-xs font-medium text-[var(--nb-text-2)]">
                        {invoiceNumber(inv.id)}
                      </span>
                    </td>

                    {/* Client */}
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-[var(--nb-text)]">
                        {inv.clients?.name ?? "—"}
                      </p>
                      {inv.clients?.email && (
                        <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                          {inv.clients.email}
                        </p>
                      )}
                    </td>

                    {/* Description */}
                    <td className="px-5 py-3.5 text-[var(--nb-text-2)] max-w-[200px] truncate">
                      {inv.type}
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3.5 text-[var(--nb-text-2)] whitespace-nowrap">
                      {formatDate(inv.date)}
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-3.5 text-right font-semibold text-[var(--nb-text)] tabular-nums whitespace-nowrap">
                      {format(inv.amount)}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5 text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.text} ${cfg.bg}`}
                      >
                        <span className={`size-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(inv.status === "pending" || inv.status === "overdue") && (
                          <RemindButton />
                        )}
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--nb-text-2)] bg-[var(--nb-card)] hover:bg-[var(--nb-bg)] border border-[var(--nb-border)] transition-colors"
                        >
                          <Eye size={12} />
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}

        {/* Table footer */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-[var(--nb-border)] flex items-center justify-between bg-[var(--nb-card)]">
            <span className="text-xs text-[var(--nb-text-2)]">
              Showing {filtered.length} of {invoices.length} invoice
              {invoices.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs font-semibold text-[var(--nb-text)]">
              Total:{" "}
              {format(
                filtered.reduce((sum, inv) => sum + (inv.amount ?? 0), 0)
              )}
            </span>
          </div>
        )}
      </div>
    </div>

    <NewInvoiceDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      onSuccess={handleInvoiceCreated}
    />

    <InvoiceDetailDialog
      invoice={selectedInvoice}
      open={!!selectedInvoice}
      onOpenChange={(v) => { if (!v) setSelectedInvoice(null); }}
      onStatusChanged={handleStatusChanged}
      onDeleted={handleInvoiceDeleted}
    />

    {showToast && (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-medium bg-emerald-600 text-white animate-in slide-in-from-bottom-4 fade-in duration-200">
        <CheckCircle2 size={16} className="shrink-0" />
        {toastMessage}
      </div>
    )}
    </>
  );
}
