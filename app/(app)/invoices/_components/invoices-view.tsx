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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Invoice, InvoiceSummary } from "../page";
import { NewInvoiceDialog } from "./new-invoice-dialog";
import { InvoiceDetailDialog } from "./invoice-detail-dialog";

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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

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
    <div className="bg-white rounded-xl border border-[#D6EAF0] px-6 py-5 flex items-center gap-4 shadow-sm">
      <div
        className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}
      >
        <Icon size={20} className={iconColor} />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">
          {label}
        </p>
        <p className="text-2xl font-semibold text-gray-900 leading-none">
          {value}
        </p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
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
    <div className="p-8 space-y-7">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track payments and outstanding balances
          </p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-[#1A8FAF] hover:bg-[#157a97] text-white gap-1.5"
        >
          <Plus size={15} />
          New Invoice
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-5">
        <SummaryCard
          label={`Revenue — ${monthName}`}
          value={formatCurrency(summary.totalThisMonth)}
          sub="From paid invoices this month"
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <SummaryCard
          label="Outstanding"
          value={formatCurrency(summary.outstanding)}
          sub={`${counts.pending} unpaid invoice${counts.pending !== 1 ? "s" : ""}`}
          icon={Clock}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <SummaryCard
          label="Deposits Held"
          value={formatCurrency(summary.depositsHeld)}
          sub={`${counts.deposit} deposit${counts.deposit !== 1 ? "s" : ""} on file`}
          icon={Landmark}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
        />
      </div>

      {/* Filter + table */}
      <div className="bg-white rounded-xl border border-[#D6EAF0] shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="flex items-center gap-1 px-4 py-3 border-b border-[#D6EAF0]">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === value
                  ? "bg-[#1A8FAF] text-white"
                  : "text-gray-500 hover:bg-[#F0F7FA] hover:text-gray-900"
              }`}
            >
              {label}
              <span
                className={`text-xs rounded-full px-1.5 py-0.5 leading-none ${
                  filter === value
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {counts[value]}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            No invoices found
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#D6EAF0] bg-[#F8FCFE]">
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
                    className={`px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide ${
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
            <tbody className="divide-y divide-[#EEF5F8]">
              {filtered.map((inv) => {
                const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.pending;
                return (
                  <tr
                    key={inv.id}
                    className="hover:bg-[#F8FCFE] transition-colors group"
                  >
                    {/* Invoice # */}
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-mono text-xs font-medium text-gray-400">
                        {invoiceNumber(inv.id)}
                      </span>
                    </td>

                    {/* Client */}
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">
                        {inv.clients?.name ?? "—"}
                      </p>
                      {inv.clients?.email && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {inv.clients.email}
                        </p>
                      )}
                    </td>

                    {/* Description */}
                    <td className="px-5 py-3.5 text-gray-600 max-w-[200px] truncate">
                      {inv.type}
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                      {formatDate(inv.date)}
                    </td>

                    {/* Amount */}
                    <td className="px-5 py-3.5 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                      {formatCurrency(inv.amount)}
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
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 bg-white hover:bg-[#F0F7FA] border border-[#D6EAF0] transition-colors"
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
        )}

        {/* Table footer */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-[#D6EAF0] flex items-center justify-between bg-[#F8FCFE]">
            <span className="text-xs text-gray-400">
              Showing {filtered.length} of {invoices.length} invoice
              {invoices.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs font-semibold text-gray-700">
              Total:{" "}
              {formatCurrency(
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
