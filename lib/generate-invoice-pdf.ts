import jsPDF from "jspdf";
import type { CurrencyCode } from "@/lib/currency";
import type { Invoice } from "@/app/(app)/invoices/page";

// ─── Design tokens ────────────────────────────────────────────────────────────

const PURPLE   = [124, 58, 237] as const;   // #7C3AED
const LAVENDER = [220, 210, 255] as const;  // header sub-text
const PL_BG    = [245, 243, 255] as const;  // table header bg (#F5F3FF)
const DARK     = [17,  17,  17]  as const;  // near-black text
const MID      = [100, 100, 100] as const;  // secondary text
const LIGHT    = [170, 170, 170] as const;  // muted text / dividers
const ROW_BG   = [250, 250, 252] as const;  // table data row bg

const STATUS_CONFIG = {
  paid:    { bg: [209, 250, 229] as const, fg: [6,   95,  70]  as const },
  pending: { bg: [254, 243, 199] as const, fg: [146, 64,  14]  as const },
  overdue: { bg: [254, 226, 226] as const, fg: [153, 27,  27]  as const },
  deposit: { bg: [224, 242, 254] as const, fg: [7,   89,  133] as const },
};

const STATUS_LABELS: Record<Invoice["status"], string> = {
  paid: "PAID", pending: "PENDING", overdue: "OVERDUE", deposit: "DEPOSIT",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function invoiceNum(id: string | number) {
  return `#${String(id).padStart(4, "0")}`;
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

// jsPDF Helvetica uses WinAnsiEncoding — ASCII-safe prefixes for non-Latin-1 symbols
const PDF_PREFIX: Record<CurrencyCode, string> = {
  USD: "$",
  GBP: "GBP ",
  EUR: "EUR ",
  ILS: "ILS ",
  ZAR: "R",
};

function fmtAmount(amount: number, currency: CurrencyCode) {
  return PDF_PREFIX[currency] + amount.toLocaleString("en-US");
}

function clientSlug(name: string | null | undefined) {
  return (name ?? "client")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// Shorthand setters
function fill(doc: jsPDF, c: readonly [number, number, number]) {
  doc.setFillColor(c[0], c[1], c[2]);
}
function stroke(doc: jsPDF, c: readonly [number, number, number]) {
  doc.setDrawColor(c[0], c[1], c[2]);
}
function color(doc: jsPDF, c: readonly [number, number, number]) {
  doc.setTextColor(c[0], c[1], c[2]);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateInvoicePDF(
  invoice: Invoice,
  studioName: string,
  currency: CurrencyCode,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const PAGE_W = 210;
  const L = 20;   // left content edge
  const R = 190;  // right content edge
  const CW = 170; // content width

  // ── Header band ─────────────────────────────────────────────────────────────
  const HEADER_H = 52;
  fill(doc, PURPLE);
  doc.rect(0, 0, PAGE_W, HEADER_H, "F");

  // Logo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  color(doc, [255, 255, 255]);
  doc.text("TATFLOW", L, 24);

  // "Invoice" sub-label under logo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  color(doc, LAVENDER);
  doc.text("Invoice", L, 35);

  // Invoice number (top-right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  color(doc, [255, 255, 255]);
  doc.text(invoiceNum(invoice.id), R, 24, { align: "right" });

  // Date (below number)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  color(doc, LAVENDER);
  doc.text(fmtDate(invoice.date), R, 34, { align: "right" });

  // ── FROM section ────────────────────────────────────────────────────────────
  let y = HEADER_H + 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  color(doc, LIGHT);
  doc.text("FROM", L, y);

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  color(doc, DARK);
  doc.text(studioName || "Your Studio", L, y);

  // ── Divider ─────────────────────────────────────────────────────────────────
  y += 11;
  doc.setLineWidth(0.25);
  stroke(doc, [220, 220, 220]);
  doc.line(L, y, R, y);

  // ── BILLED TO section ───────────────────────────────────────────────────────
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  color(doc, LIGHT);
  doc.text("BILLED TO", L, y);

  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  color(doc, DARK);
  doc.text(invoice.clients?.name || "—", L, y);

  if (invoice.clients?.email) {
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    color(doc, MID);
    doc.text(invoice.clients.email, L, y);
  }

  // ── Services table ──────────────────────────────────────────────────────────
  y += 16;

  // Table header row
  const ROW_H = 10;
  fill(doc, PL_BG);
  doc.rect(L, y - 6.5, CW, ROW_H, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  color(doc, PURPLE);
  doc.text("DESCRIPTION", L + 5, y);
  doc.text("AMOUNT", R - 5, y, { align: "right" });

  // Data row
  y += 12;
  fill(doc, ROW_BG);
  doc.rect(L, y - 6.5, CW, ROW_H + 1, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  color(doc, DARK);

  const descText = invoice.type || "Tattoo Service";
  // Clamp long descriptions
  const descLines = doc.splitTextToSize(descText, CW - 60);
  doc.text(descLines[0], L + 5, y);
  doc.text(fmtAmount(invoice.amount, currency), R - 5, y, { align: "right" });

  // Linked request note (if present)
  if (invoice.tattoo_requests) {
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    color(doc, MID);
    const note = [
      invoice.tattoo_requests.style ? `Style: ${invoice.tattoo_requests.style}` : null,
      invoice.tattoo_requests.description.split("\n")[0],
    ]
      .filter(Boolean)
      .join("  ·  ");
    const noteLines = doc.splitTextToSize(note, CW - 10);
    doc.text(noteLines, L + 5, y);
    y += (noteLines.length - 1) * 4.5;
  }

  // ── Totals section ──────────────────────────────────────────────────────────
  y += 22;

  // Thin divider above total
  doc.setLineWidth(0.25);
  stroke(doc, [220, 220, 220]);
  doc.line(L, y - 6, R, y - 6);

  // "Total Due" label
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  color(doc, MID);
  doc.text("Total Due", R - 58, y);

  // Big amount in purple
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  color(doc, PURPLE);
  doc.text(fmtAmount(invoice.amount, currency), R, y, { align: "right" });

  // Status badge
  y += 13;
  const statusCfg = STATUS_CONFIG[invoice.status];
  const statusLabel = STATUS_LABELS[invoice.status];
  const BADGE_W = 32;
  const BADGE_H = 9;
  fill(doc, statusCfg.bg);
  doc.roundedRect(R - BADGE_W, y - 7, BADGE_W, BADGE_H, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  color(doc, statusCfg.fg);
  doc.text(statusLabel, R - BADGE_W / 2, y - 1, { align: "center" });

  // ── Footer ──────────────────────────────────────────────────────────────────
  const FOOTER_Y = 273;

  doc.setLineWidth(0.5);
  stroke(doc, PURPLE);
  doc.line(L, FOOTER_Y, R, FOOTER_Y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  color(doc, DARK);
  doc.text("Thank you for your business!", PAGE_W / 2, FOOTER_Y + 9, { align: "center" });

  doc.setFontSize(8);
  color(doc, LIGHT);
  doc.text("Powered by Tatflow  ·  tatflow.ink", PAGE_W / 2, FOOTER_Y + 17, { align: "center" });

  // ── Save ────────────────────────────────────────────────────────────────────
  const num = String(invoice.id).padStart(4, "0");
  const slug = clientSlug(invoice.clients?.name);
  doc.save(`invoice-${num}-${slug}.pdf`);
}
