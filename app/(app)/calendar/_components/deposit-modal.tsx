"use client";

import { useState } from "react";
import {
  X,
  Copy,
  Check,
  Loader2,
  CreditCard,
  Link as LinkIcon,
} from "lucide-react";
import { getPaddleClient } from "@/lib/paddle/client";

// ─── Types ─────────────────────────────────────────────────────────────────────

type DepositModalProps = {
  appointmentId: string;
  clientName: string;
  clientEmail?: string;
  defaultDescription?: string;
  onClose: () => void;
};

const CURRENCIES = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "ILS", label: "ILS — Israeli Shekel" },
];

const inputClass =
  "h-9 w-full rounded-lg border border-[var(--nb-border)] bg-[var(--nb-bg)] px-3 text-sm text-[var(--nb-text)] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors placeholder:text-[var(--nb-text-2)]";

// ─── Component ─────────────────────────────────────────────────────────────────

export function DepositModal({
  appointmentId,
  clientName,
  clientEmail,
  defaultDescription,
  onClose,
}: DepositModalProps) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState(defaultDescription ?? "");
  const [amountError, setAmountError] = useState("");

  // Link flow
  const [linkLoading, setLinkLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Charge now flow
  const [chargeLoading, setChargeLoading] = useState(false);

  const [serverError, setServerError] = useState("");

  function validate() {
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n <= 0) {
      setAmountError("Enter a valid amount greater than 0");
      return false;
    }
    setAmountError("");
    return true;
  }

  async function createCheckout() {
    if (!validate()) return null;
    const res = await fetch("/api/paddle/create-deposit-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parseFloat(amount),
        currency,
        client_name: clientName,
        client_email: clientEmail ?? undefined,
        appointment_id: appointmentId,
        description: description.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setServerError(data.error ?? "Failed to create checkout");
      return null;
    }
    return data as { checkout_url: string | null; transaction_id: string };
  }

  async function handleSendLink() {
    setLinkLoading(true);
    setServerError("");
    const result = await createCheckout();
    setLinkLoading(false);
    if (!result) return;

    const url = result.checkout_url;
    if (!url) {
      setServerError("Paddle did not return a checkout URL");
      return;
    }
    setCheckoutUrl(url);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleChargeNow() {
    setChargeLoading(true);
    setServerError("");
    const result = await createCheckout();
    setChargeLoading(false);
    if (!result) return;

    try {
      const paddle = await getPaddleClient();
      if (!paddle) {
        setServerError("Paddle client failed to initialize");
        return;
      }
      paddle.Checkout.open({ transactionId: result.transaction_id });
      onClose();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to open checkout");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-[var(--nb-card)] rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--nb-border)]">
          <div>
            <h3 className="text-base font-semibold text-[var(--nb-text)]">
              Request Deposit
            </h3>
            <p className="text-xs text-[var(--nb-text-2)] mt-0.5">{clientName}</p>
          </div>
          <button
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-[var(--nb-bg)] transition-colors text-[var(--nb-text-2)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Amount + Currency */}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">
                Amount *
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="e.g. 100"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (amountError) setAmountError("");
                }}
                className={inputClass}
              />
              {amountError && (
                <p className="text-xs text-red-500">{amountError}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={`${inputClass} pr-7`}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Sleeve deposit — Alex"
              className={inputClass}
            />
          </div>

          {/* Checkout URL display (after link is generated) */}
          {checkoutUrl && (
            <div className="rounded-xl bg-[var(--nb-bg)] border border-[var(--nb-border)] px-3 py-3 space-y-1.5">
              <p className="text-[11px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">
                Payment Link
              </p>
              <p className="text-xs text-[var(--nb-text)] break-all leading-relaxed">
                {checkoutUrl}
              </p>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(checkoutUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  copied
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-[var(--nb-card)] text-[var(--nb-text-2)] border border-[var(--nb-border)] hover:text-[var(--nb-text)]"
                }`}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          )}

          {serverError && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {serverError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--nb-border)] flex items-center gap-2">
          {/* Send Payment Link */}
          <button
            onClick={handleSendLink}
            disabled={linkLoading || chargeLoading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border border-[var(--nb-border)] bg-[var(--nb-bg)] text-[var(--nb-text)] hover:bg-[var(--nb-border)] transition-colors disabled:opacity-50"
          >
            {linkLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <LinkIcon size={13} />
            )}
            {linkLoading ? "Generating…" : checkoutUrl ? "Regenerate" : "Send Link"}
          </button>

          {/* Charge Now */}
          <button
            onClick={handleChargeNow}
            disabled={linkLoading || chargeLoading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-[#7C3AED] hover:bg-[#6D28D9] text-white transition-colors disabled:opacity-50"
          >
            {chargeLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <CreditCard size={13} />
            )}
            {chargeLoading ? "Opening…" : "Charge Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
