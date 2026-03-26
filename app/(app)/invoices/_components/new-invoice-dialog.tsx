"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { supabase, getUserId } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type Client = { id: string | number; name: string; email: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const INVOICE_TYPES = [
  "Full session payment",
  "Deposit",
  "Touch-up",
  "Flash piece",
  "Consultation fee",
];

const selectCls =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 transition-colors";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Client search combobox ───────────────────────────────────────────────────

function ClientSearch({
  clients,
  selected,
  onSelect,
}: {
  clients: Client[];
  selected: Client | null;
  onSelect: (c: Client | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? clients.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.email.toLowerCase().includes(query.toLowerCase())
      )
    : clients.slice(0, 8);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-[#B8DDE8] bg-[#E8F5FA] px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-gray-900">{selected.name}</p>
          <p className="text-xs text-gray-500">{selected.email}</p>
        </div>
        <button
          type="button"
          onClick={() => { onSelect(null); setQuery(""); }}
          className="text-xs text-[#1A8FAF] hover:underline shrink-0 ml-3"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full pl-9 pr-3 py-2 text-sm bg-[#F0F7FA] border border-[#D6EAF0] rounded-lg outline-none focus:border-[#1A8FAF] focus:ring-2 focus:ring-[#1A8FAF]/20 transition-colors placeholder:text-gray-400"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-[#D6EAF0] bg-white shadow-lg">
          {filtered.map((c) => (
            <button
              key={String(c.id)}
              type="button"
              onClick={() => { onSelect(c); setQuery(""); setOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#F0F7FA] transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <div className="size-8 rounded-full bg-[#E8F5FA] flex items-center justify-center text-xs font-semibold text-[#1A8FAF] shrink-0">
                {c.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                <p className="text-xs text-gray-400 truncate">{c.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && query.trim() && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-[#D6EAF0] bg-white shadow-lg px-3 py-4 text-sm text-gray-400 text-center">
          No clients found
        </div>
      )}
    </div>
  );
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

const EMPTY = {
  selectedClient: null as Client | null,
  description: "",
  invoiceType: "Full session payment",
  amount: "",
  status: "pending",
  date: "",
};

export function NewInvoiceDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY, date: todayStr() });
  const [clients, setClients] = useState<Client[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      getUserId().then((userId) => {
        if (!userId) return;
        supabase
          .from("clients")
          .select("id, name, email")
          .eq("user_id", userId)
          .order("name")
          .then(({ data }) => setClients((data as Client[]) ?? []));
      });
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setForm({ ...EMPTY, date: todayStr() });
      setErrors({});
      setServerError(null);
    }
  }, [open]);

  function setField<K extends keyof typeof EMPTY>(
    key: K,
    value: (typeof EMPTY)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined! }));
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.selectedClient) errs.client = "Please select a client";
    if (
      !form.amount.trim() ||
      isNaN(Number(form.amount)) ||
      Number(form.amount) <= 0
    ) {
      errs.amount = "Enter a valid amount";
    }
    if (!form.date) errs.date = "Date is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError(null);

    const userId = await getUserId();
    if (!userId) { setServerError("Not authenticated"); setSubmitting(false); return; }

    // Combine type + optional description into the type column
    const typeValue = form.description.trim()
      ? `${form.invoiceType} — ${form.description.trim()}`
      : form.invoiceType;

    const { error } = await supabase.from("invoices").insert({
      user_id: userId,
      client_id: form.selectedClient!.id,
      type: typeValue,
      amount: Number(form.amount),
      status: form.status,
      date: form.date,
    });

    setSubmitting(false);

    if (error) {
      setServerError(error.message);
      return;
    }

    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Invoice</DialogTitle>
        </DialogHeader>

        <form
          id="new-invoice-form"
          onSubmit={handleSubmit}
          className="space-y-4 pt-1"
        >
          {/* Client */}
          <div className="space-y-1.5">
            <Label>
              Client{" "}
              <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <ClientSearch
              clients={clients}
              selected={form.selectedClient}
              onSelect={(c) => setField("selectedClient", c)}
            />
            {errors.client && (
              <p className="text-xs text-destructive">{errors.client}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="inv-desc">Description</Label>
            <Input
              id="inv-desc"
              placeholder="e.g. Right arm sleeve, session 2 of 3…"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="inv-type">Type</Label>
            <select
              id="inv-type"
              value={form.invoiceType}
              onChange={(e) => setField("invoiceType", e.target.value)}
              className={selectCls}
            >
              {INVOICE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Amount + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-amount">
                Amount{" "}
                <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                  $
                </span>
                <Input
                  id="inv-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setField("amount", e.target.value)}
                  className="pl-7"
                  aria-invalid={!!errors.amount}
                />
              </div>
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-status">Status</Label>
              <select
                id="inv-status"
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
                className={selectCls}
              >
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="deposit">Deposit</option>
              </select>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="inv-date">
              Date{" "}
              <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input
              id="inv-date"
              type="date"
              value={form.date}
              onChange={(e) => setField("date", e.target.value)}
              aria-invalid={!!errors.date}
            />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date}</p>
            )}
          </div>

          {serverError && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {serverError}
            </p>
          )}
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={submitting}>Cancel</Button>
          </DialogClose>
          <Button
            type="submit"
            form="new-invoice-form"
            disabled={submitting}
            className="bg-[#1A8FAF] hover:bg-[#157a97] text-white gap-1.5"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            {submitting ? "Creating…" : "Create Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
