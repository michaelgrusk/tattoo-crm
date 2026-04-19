"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  Clock,
  Users,
  UserPlus,
  ChevronDown,
  Star,
  RefreshCw,
  Zap,
  Palette,
  UserCheck,
} from "lucide-react";
import { supabase, getUserId } from "@/lib/supabase/client";
import { useCurrency } from "@/components/currency-provider";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "month" | "3m" | "6m" | "year" | "custom";

type Invoice = {
  id: string;
  amount: number;
  date: string;
  client_id: string;
  clients: { name: string } | null;
};

type AppointmentRow = { time: string; date: string; client_id: string; status: string };
type RequestRow = { style: string; inquiry_type: string | null };
type ReferralRow = { referral_source: string | null };
type CompletedTattooRow = { style: string | null; session_date: string | null; client_id: string };
type ArtistApptRow = {
  artist_id: number | null;
  type: string;
  date: string;
  client_id: string | null;
  artists: { id: number; name: string; avatar_url: string | null } | null;
};

// ─── Period helpers ───────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "3m",    label: "Past 3 months" },
  { value: "6m",    label: "Past 6 months" },
  { value: "year",  label: "This year" },
  { value: "custom",label: "Custom range" },
];

function pad(n: number) { return String(n).padStart(2, "0"); }
function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function getStartDate(period: Exclude<Period, "custom">): string {
  const now = new Date();
  if (period === "month") return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  if (period === "year")  return `${now.getFullYear()}-01-01`;
  const d = new Date(now);
  d.setMonth(d.getMonth() - (period === "3m" ? 3 : 6));
  return toLocalDateStr(d);
}
function getMonthBuckets(startStr: string, endStr: string) {
  const cur = new Date(startStr + "T00:00:00");
  cur.setDate(1);
  const endMonth = new Date(endStr + "T00:00:00");
  endMonth.setDate(1);
  const buckets = [];
  while (cur <= endMonth) {
    buckets.push({ year: cur.getFullYear(), month: cur.getMonth(), label: cur.toLocaleDateString("en-US", { month: "short" }) });
    cur.setMonth(cur.getMonth() + 1);
  }
  return buckets;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatHour(h: number) {
  if (h === 0) return "12 AM";
  if (h < 12)  return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_LONG = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Shared ───────────────────────────────────────────────────────────────────

const STYLE_COLORS = ["bg-[#7C3AED]","bg-violet-400","bg-amber-400","bg-rose-400","bg-emerald-400","bg-indigo-400"];
const EXCLUDED_STYLES = new Set(["reference","null","n/a","other",""]);

const ARTIST_AVATAR_COLORS = [
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-sky-100",    text: "text-sky-700"    },
  { bg: "bg-emerald-100",text: "text-emerald-700"},
  { bg: "bg-amber-100",  text: "text-amber-700"  },
  { bg: "bg-rose-100",   text: "text-rose-700"   },
];
function getArtistColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return ARTIST_AVATAR_COLORS[Math.abs(hash) % ARTIST_AVATAR_COLORS.length];
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, iconBg, iconColor, loading, highlight,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
  loading: boolean; highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border px-5 py-5 shadow-sm ${highlight ? "bg-gradient-to-br from-[#7C3AED]/10 to-[#7C3AED]/5 border-[#7C3AED]/20" : "bg-[var(--nb-card)] border-[var(--nb-border)]"}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={17} className={iconColor} />
        </div>
        <p className="text-xs font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-2xl font-semibold transition-opacity ${highlight ? "text-[#7C3AED]" : "text-[var(--nb-text)]"} ${loading ? "opacity-30" : ""}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-[var(--nb-text-2)] mt-1">{sub}</p>}
    </div>
  );
}

// ─── Revenue Chart (dual series: revenue bars + session dots) ─────────────────

function RevenueChart({
  invoices, appointments, start, end, loading,
}: {
  invoices: Invoice[];
  appointments: AppointmentRow[];
  start: string;
  end: string;
  loading: boolean;
}) {
  const { format, formatShort } = useCurrency();
  const buckets = getMonthBuckets(start, end);

  const data = buckets.map(({ year, month, label }) => {
    const monthInvoices = invoices.filter((inv) => {
      const d = new Date(inv.date + "T00:00:00");
      return d.getFullYear() === year && d.getMonth() === month;
    });
    const monthAppts = appointments.filter((a) => {
      const d = new Date(a.date + "T00:00:00");
      return d.getFullYear() === year && d.getMonth() === month;
    });
    return { label, total: monthInvoices.reduce((s, i) => s + i.amount, 0), sessions: monthAppts.length };
  });

  const maxRev  = Math.max(...data.map((d) => d.total), 1);
  const maxSess = Math.max(...data.map((d) => d.sessions), 1);
  const CHART_H = 140;

  // Best month
  const bestIdx = data.reduce((bi, d, i) => (d.total > (data[bi]?.total ?? 0) ? i : bi), 0);
  // MoM growth (last two buckets with data)
  const withRev = data.filter((d) => d.total > 0);
  let momGrowth: number | null = null;
  if (withRev.length >= 2) {
    const last = withRev[withRev.length - 1].total;
    const prev = withRev[withRev.length - 2].total;
    momGrowth = prev > 0 ? ((last - prev) / prev) * 100 : null;
  }

  return (
    <div className={`transition-opacity ${loading ? "opacity-40" : ""}`}>
      {/* MoM badge + legend */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {momGrowth !== null && (
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${momGrowth >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {momGrowth >= 0 ? "▲" : "▼"} {Math.abs(momGrowth).toFixed(1)}% vs prev month
          </span>
        )}
        {data[bestIdx]?.total > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--nb-text-2)]">
            <Star size={10} className="text-amber-500 fill-amber-400" />
            Best: {data[bestIdx].label} ({formatShort(data[bestIdx].total)})
          </span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--nb-text-2)]">
            <span className="w-3 h-2.5 rounded-sm bg-[#7C3AED] inline-block" /> Revenue
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--nb-text-2)]">
            <span className="w-3 h-0.5 bg-amber-400 inline-block" /> Sessions
          </span>
        </div>
      </div>

      <div className="relative" style={{ height: CHART_H + 36 }}>
        {/* Y-axis grid lines */}
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <div
            key={frac}
            className="absolute inset-x-0 border-t border-dashed border-[var(--nb-card)] flex items-start pointer-events-none"
            style={{ top: CHART_H - frac * CHART_H }}
          >
            <span className="text-[9px] text-[var(--nb-text-2)] pr-2 -mt-2.5 select-none tabular-nums">
              {formatShort(maxRev * frac)}
            </span>
          </div>
        ))}

        {/* Revenue bars */}
        <div className="absolute bottom-9 inset-x-0 flex items-end gap-1.5" style={{ height: CHART_H }}>
          {data.map(({ label, total, sessions }, i) => {
            const barH = Math.max((total / maxRev) * CHART_H, total > 0 ? 4 : 2);
            const isBest = i === bestIdx && total > 0;
            const sessionY = CHART_H - (sessions / maxSess) * CHART_H;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0 group relative" style={{ height: CHART_H }}>
                {/* Tooltip */}
                {total > 0 && (
                  <div className="absolute bottom-full mb-2 bg-[#1E1B4B] text-white text-[10px] font-medium px-2 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg left-1/2 -translate-x-1/2">
                    {format(total)} · {sessions} session{sessions !== 1 ? "s" : ""}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#1E1B4B]" />
                  </div>
                )}
                {/* Revenue bar */}
                <div
                  className={`absolute bottom-0 w-full rounded-t-md transition-all duration-500 ${
                    isBest ? "bg-amber-400" : total > 0 ? "bg-[#7C3AED]" : "bg-[var(--nb-card)]"
                  }`}
                  style={{ height: barH }}
                />
                {/* Session dot on secondary axis */}
                {sessions > 0 && (
                  <div
                    className="absolute w-2 h-2 rounded-full bg-amber-400 border-2 border-[var(--nb-card)] z-10 transition-all duration-500"
                    style={{ bottom: sessionY + 2, left: "50%", transform: "translateX(-50%)" }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Session line path (SVG overlay) */}
        {data.some(d => d.sessions > 0) && (
          <svg
            className="absolute bottom-9 inset-x-0 pointer-events-none overflow-visible"
            style={{ height: CHART_H }}
            preserveAspectRatio="none"
          >
            {(() => {
              const w = 100 / data.length;
              const points = data.map((d, i) => {
                const x = (i + 0.5) * w;
                const y = CHART_H - (d.sessions / maxSess) * CHART_H + 4;
                return `${x}%,${y}`;
              });
              return (
                <polyline
                  points={points.join(" ")}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.6"
                />
              );
            })()}
          </svg>
        )}

        {/* X-axis labels + session count */}
        <div className="absolute bottom-0 inset-x-0 flex gap-1.5">
          {data.map(({ label, sessions }, i) => (
            <div key={i} className="flex-1 text-center">
              <div className="text-[9px] text-amber-500 font-semibold leading-none mb-0.5">{sessions > 0 ? sessions : ""}</div>
              <span className="text-[11px] text-[var(--nb-text-2)] select-none">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Revenue by Style ─────────────────────────────────────────────────────────

function RevenueByStyle({
  completedTattoos, avgTicket, loading,
}: {
  completedTattoos: CompletedTattooRow[];
  avgTicket: number;
  loading: boolean;
}) {
  const { format } = useCurrency();

  const counts: Record<string, number> = {};
  for (const ct of completedTattoos) {
    const style = ct.style?.trim() ?? "";
    if (style && !EXCLUDED_STYLES.has(style.toLowerCase())) {
      counts[style] = (counts[style] ?? 0) + 1;
    }
  }

  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 8);
  const maxCount = sorted[0]?.[1] ?? 1;

  if (!loading && sorted.length === 0) {
    return <p className="text-sm text-[var(--nb-text-2)] py-6 text-center">No completed tattoos logged yet</p>;
  }

  return (
    <div className={`space-y-3 transition-opacity ${loading ? "opacity-40" : ""}`}>
      <div className="hidden sm:grid grid-cols-4 gap-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--nb-text-2)] px-1 mb-1">
        <span>Style</span>
        <span className="text-right">Sessions</span>
        <span className="text-right">Est. Revenue</span>
        <span className="text-right">Avg Ticket</span>
      </div>
      {sorted.map(([style, count], i) => {
        const estRev = count * avgTicket;
        const pct = (count / maxCount) * 100;
        const color = STYLE_COLORS[i % STYLE_COLORS.length];
        return (
          <div key={style} className="grid grid-cols-1 sm:grid-cols-4 gap-1 sm:gap-2 items-center">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`size-2.5 rounded-full shrink-0 ${color}`} />
              <span className="text-sm font-medium text-[var(--nb-text)] truncate">{style}</span>
            </div>
            <div className="sm:col-span-3 sm:grid sm:grid-cols-3 sm:gap-2 sm:items-center pl-4 sm:pl-0">
              <div className="flex sm:flex-col sm:items-end gap-2 sm:gap-0">
                <div className="w-full h-1.5 bg-[var(--nb-bg)] rounded-full overflow-hidden sm:hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-semibold text-[var(--nb-text)] tabular-nums">{count} session{count !== 1 ? "s" : ""}</span>
              </div>
              <div className="hidden sm:flex sm:flex-col sm:items-end">
                <div className="h-1.5 bg-[var(--nb-bg)] rounded-full overflow-hidden w-full mb-1">
                  <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-semibold text-[var(--nb-text)] tabular-nums">{avgTicket > 0 ? format(Math.round(estRev)) : "—"}</span>
              </div>
              <span className="hidden sm:block text-xs text-[var(--nb-text-2)] text-right tabular-nums">
                {avgTicket > 0 ? format(Math.round(avgTicket)) : "—"}
              </span>
            </div>
          </div>
        );
      })}
      {avgTicket > 0 && (
        <p className="text-[11px] text-[var(--nb-text-2)] pt-1 border-t border-[var(--nb-border)]">
          * Revenue estimated: sessions × avg ticket ({format(Math.round(avgTicket))})
        </p>
      )}
    </div>
  );
}

// ─── Busiest Hours ────────────────────────────────────────────────────────────

function BusiestHours({ appointments, loading }: { appointments: AppointmentRow[]; loading: boolean }) {
  const counts: Record<number, number> = {};
  for (const appt of appointments) {
    const hour = parseInt(appt.time.split(":")[0], 10);
    if (!isNaN(hour) && hour >= 8 && hour <= 20) {
      counts[hour] = (counts[hour] ?? 0) + 1;
    }
  }
  const hours = Array.from({ length: 12 }, (_, i) => i + 9);
  const max = Math.max(...hours.map((h) => counts[h] ?? 0), 1);
  const hasData = hours.some((h) => (counts[h] ?? 0) > 0);

  if (!loading && !hasData) return <p className="text-sm text-[var(--nb-text-2)] py-6 text-center">No appointments yet</p>;

  return (
    <div className={`space-y-2 transition-opacity ${loading ? "opacity-40" : ""}`}>
      {hours.map((h) => {
        const count = counts[h] ?? 0;
        const pct = (count / max) * 100;
        return (
          <div key={h} className="flex items-center gap-2.5">
            <span className="text-[11px] text-[var(--nb-text-2)] w-11 shrink-0 text-right tabular-nums">{formatHour(h)}</span>
            <div className="flex-1 h-4 bg-[var(--nb-bg)] rounded-md overflow-hidden">
              <div className="h-full bg-[#7C3AED] rounded-md transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] font-medium text-[var(--nb-text-2)] w-4 shrink-0 tabular-nums">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Busiest Months ───────────────────────────────────────────────────────────

function BusiestMonths({ appointments, loading }: { appointments: AppointmentRow[]; loading: boolean }) {
  const counts: Record<number, number> = {};
  for (const appt of appointments) {
    const m = new Date(appt.date + "T00:00:00").getMonth();
    counts[m] = (counts[m] ?? 0) + 1;
  }
  const max = Math.max(...Object.values(counts), 1);
  const sorted = MONTHS_LONG.map((label, i) => ({ label, count: counts[i] ?? 0, idx: i }));
  const topThree = [...sorted].sort((a, b) => b.count - a.count).slice(0, 3).map((m) => m.idx);

  if (!loading && Object.keys(counts).length === 0) {
    return <p className="text-sm text-[var(--nb-text-2)] py-6 text-center">No appointment data yet</p>;
  }

  return (
    <div className={`space-y-2 transition-opacity ${loading ? "opacity-40" : ""}`}>
      {sorted.map(({ label, count, idx }) => {
        const pct = (count / max) * 100;
        const isTop = topThree.includes(idx);
        return (
          <div key={label} className="flex items-center gap-2.5">
            <span className={`text-[11px] w-7 shrink-0 text-right tabular-nums font-medium ${isTop ? "text-[#7C3AED]" : "text-[var(--nb-text-2)]"}`}>{label}</span>
            <div className="flex-1 h-4 bg-[var(--nb-bg)] rounded-md overflow-hidden">
              <div
                className={`h-full rounded-md transition-all duration-500 ${isTop ? "bg-[#7C3AED]" : "bg-violet-200"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-[11px] font-medium w-5 shrink-0 tabular-nums ${isTop ? "text-[#7C3AED]" : "text-[var(--nb-text-2)]"}`}>{count}</span>
            {topThree[0] === idx && count > 0 && <Star size={11} className="text-amber-500 fill-amber-400 shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Busiest Days of Week ─────────────────────────────────────────────────────

function BusiestDays({ appointments, loading }: { appointments: AppointmentRow[]; loading: boolean }) {
  const counts: Record<number, number> = {};
  for (const appt of appointments) {
    const day = new Date(appt.date + "T00:00:00").getDay();
    counts[day] = (counts[day] ?? 0) + 1;
  }
  // Show Mon-Sun (1-6, 0)
  const order = [1, 2, 3, 4, 5, 6, 0];
  const max = Math.max(...order.map((d) => counts[d] ?? 0), 1);

  return (
    <div className={`space-y-2 transition-opacity ${loading ? "opacity-40" : ""}`}>
      {order.map((dayIdx) => {
        const count = counts[dayIdx] ?? 0;
        const pct = (count / max) * 100;
        return (
          <div key={dayIdx} className="flex items-center gap-2.5">
            <span className="text-[11px] text-[var(--nb-text-2)] w-7 shrink-0 text-right">{DAYS[dayIdx]}</span>
            <div className="flex-1 h-4 bg-[var(--nb-bg)] rounded-md overflow-hidden">
              <div className="h-full bg-[#7C3AED] rounded-md transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] font-medium text-[var(--nb-text-2)] w-4 shrink-0 tabular-nums">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Top Clients ──────────────────────────────────────────────────────────────

function TopClients({ invoices, loading }: { invoices: Invoice[]; loading: boolean }) {
  const { format } = useCurrency();
  const byClient: Record<string, { name: string; total: number }> = {};
  for (const inv of invoices) {
    if (!inv.client_id) continue;
    if (!byClient[inv.client_id]) byClient[inv.client_id] = { name: inv.clients?.name ?? "Unknown", total: 0 };
    byClient[inv.client_id].total += inv.amount;
  }
  const sorted = Object.values(byClient).sort((a, b) => b.total - a.total).slice(0, 6);
  const max = sorted[0]?.total ?? 1;

  if (!loading && sorted.length === 0) return <p className="text-sm text-[var(--nb-text-2)] py-6 text-center">No data yet</p>;

  return (
    <div className={`space-y-4 transition-opacity ${loading ? "opacity-40" : ""}`}>
      {sorted.map(({ name, total }, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[var(--nb-text-2)] w-4 shrink-0 tabular-nums">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-[var(--nb-text)] truncate">{name}</span>
              <span className="text-sm font-semibold text-[var(--nb-text)] ml-3 shrink-0 tabular-nums">{format(total)}</span>
            </div>
            <div className="h-1.5 bg-[var(--nb-bg)] rounded-full overflow-hidden">
              <div className="h-full bg-[#7C3AED] rounded-full transition-all duration-500" style={{ width: `${(total / max) * 100}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Popular Styles ───────────────────────────────────────────────────────────

function PopularStyles({ requests, loading }: { requests: RequestRow[]; loading: boolean }) {
  const counts: Record<string, number> = {};
  for (const r of requests) {
    const style = r.style?.trim() ?? "";
    if (style && !EXCLUDED_STYLES.has(style.toLowerCase())) {
      counts[style] = (counts[style] ?? 0) + 1;
    }
  }
  const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 6);

  if (!loading && sorted.length === 0) return <p className="text-sm text-[var(--nb-text-2)] py-6 text-center">No data yet</p>;

  return (
    <div className={`space-y-4 transition-opacity ${loading ? "opacity-40" : ""}`}>
      {sorted.map(([style, count], i) => {
        const pct = Math.round((count / total) * 100);
        const color = STYLE_COLORS[i % STYLE_COLORS.length];
        return (
          <div key={style} className="flex items-center gap-3">
            <div className={`size-2.5 rounded-full shrink-0 mt-0.5 ${color}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-[var(--nb-text)] truncate">{style}</span>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <span className="text-xs font-semibold text-[var(--nb-text-2)] tabular-nums">{pct}%</span>
                  <span className="text-xs text-[var(--nb-text-2)] tabular-nums">({count})</span>
                </div>
              </div>
              <div className="h-1.5 bg-[var(--nb-bg)] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Referral Sources ─────────────────────────────────────────────────────────

function ReferralSources({ referrals, loading }: { referrals: ReferralRow[]; loading: boolean }) {
  const counts: Record<string, number> = {};
  for (const r of referrals) {
    const src = r.referral_source?.trim();
    if (src) counts[src] = (counts[src] ?? 0) + 1;
  }
  const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);

  if (!loading && sorted.length === 0) {
    return <p className="text-sm text-[var(--nb-text-2)] py-6 text-center">Referral data will appear once clients submit intake forms</p>;
  }

  return (
    <div className={`space-y-4 transition-opacity ${loading ? "opacity-40" : ""}`}>
      {sorted.map(([source, count], i) => {
        const pct = Math.round((count / total) * 100);
        const color = STYLE_COLORS[i % STYLE_COLORS.length];
        return (
          <div key={source} className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[var(--nb-text-2)] w-4 shrink-0 tabular-nums">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-[var(--nb-text)] truncate">{source}</span>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <span className="text-xs font-semibold text-[var(--nb-text-2)] tabular-nums">{pct}%</span>
                  <span className="text-xs text-[var(--nb-text-2)] tabular-nums">({count})</span>
                </div>
              </div>
              <div className="h-1.5 bg-[var(--nb-bg)] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Artist Performance (with revenue) ───────────────────────────────────────

function ArtistPerformance({
  artistAppts, upcomingArtistAppts, invoices, loading,
}: {
  artistAppts: ArtistApptRow[];
  upcomingArtistAppts: { artist_id: number }[];
  invoices: Invoice[];
  loading: boolean;
}) {
  const { format } = useCurrency();

  // Build invoice lookup: date+client_id → amount
  const invoiceLookup: Record<string, number> = {};
  for (const inv of invoices) {
    const key = `${inv.date}::${inv.client_id}`;
    invoiceLookup[key] = (invoiceLookup[key] ?? 0) + inv.amount;
  }

  const map: Record<number, {
    name: string; avatar_url: string | null;
    sessions: number; revenue: number; types: Record<string, number>;
  }> = {};

  for (const row of artistAppts) {
    if (!row.artist_id || !row.artists) continue;
    if (!map[row.artist_id]) {
      map[row.artist_id] = { name: row.artists.name, avatar_url: row.artists.avatar_url, sessions: 0, revenue: 0, types: {} };
    }
    map[row.artist_id].sessions += 1;
    const t = row.type ?? "Other";
    map[row.artist_id].types[t] = (map[row.artist_id].types[t] ?? 0) + 1;
    // Match invoice by date + client_id
    if (row.client_id) {
      const key = `${row.date}::${row.client_id}`;
      map[row.artist_id].revenue += invoiceLookup[key] ?? 0;
    }
  }

  const upcomingByArtist: Record<number, number> = {};
  for (const row of upcomingArtistAppts) {
    upcomingByArtist[row.artist_id] = (upcomingByArtist[row.artist_id] ?? 0) + 1;
  }

  const rows = Object.entries(map).map(([id, v]) => {
    const topType = Object.entries(v.types).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "—";
    const avgTicket = v.sessions > 0 ? v.revenue / v.sessions : 0;
    return { id: Number(id), ...v, topType, upcoming: upcomingByArtist[Number(id)] ?? 0, avgTicket };
  }).sort((a, b) => b.revenue - a.revenue || b.sessions - a.sessions);

  if (!loading && rows.length === 0) {
    return <p className="text-sm text-[var(--nb-text-2)] py-6 text-center">No artist data yet — assign artists to appointments to see performance</p>;
  }

  return (
    <div className={`transition-opacity ${loading ? "opacity-40" : ""}`}>
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--nb-border)]">
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">Artist</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">Sessions</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">Revenue</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">Avg Ticket</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">Upcoming</th>
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">Top Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--nb-border)]">
            {rows.map((row) => {
              const initials = row.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
              const color = getArtistColor(row.name);
              return (
                <tr key={row.id} className="hover:bg-[var(--nb-bg)] transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      {row.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.avatar_url} alt={row.name} className="size-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className={`size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${color.bg} ${color.text}`}>{initials}</span>
                      )}
                      <span className="font-medium text-[var(--nb-text)]">{row.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-[var(--nb-text)]">{row.sessions}</td>
                  <td className="py-3 px-3 text-right font-semibold text-[#7C3AED]">{row.revenue > 0 ? format(Math.round(row.revenue)) : "—"}</td>
                  <td className="py-3 px-3 text-right text-[var(--nb-text-2)]">{row.avgTicket > 0 ? format(Math.round(row.avgTicket)) : "—"}</td>
                  <td className="py-3 px-3 text-right text-[var(--nb-text-2)]">{row.upcoming}</td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center rounded-full bg-[var(--nb-active-bg)] px-2.5 py-0.5 text-xs font-medium text-[#7C3AED]">{row.topType}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="sm:hidden space-y-3">
        {rows.map((row) => {
          const initials = row.name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
          const color = getArtistColor(row.name);
          return (
            <div key={row.id} className="flex items-center gap-3 rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-3">
              {row.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.avatar_url} alt={row.name} className="size-10 rounded-full object-cover shrink-0" />
              ) : (
                <span className={`size-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${color.bg} ${color.text}`}>{initials}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--nb-text)] truncate">{row.name}</p>
                <p className="text-xs text-[var(--nb-text-2)] mt-0.5">{row.sessions} sessions · {row.revenue > 0 ? format(Math.round(row.revenue)) : "no matched revenue"}</p>
              </div>
              <span className="shrink-0 inline-flex items-center rounded-full bg-[var(--nb-active-bg)] px-2.5 py-0.5 text-xs font-medium text-[#7C3AED]">{row.topType}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mini chart card ──────────────────────────────────────────────────────────

function ChartCard({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-[var(--nb-text)]">{title}</h2>
        {badge && <span className="text-xs text-[var(--nb-text-2)]">{badge}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

const DATE_INPUT_CLS = "h-9 w-full rounded-lg border border-[var(--nb-border)] bg-[var(--nb-card)] px-3 text-sm text-[var(--nb-text)] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors";

export function AnalyticsView() {
  const { format } = useCurrency();
  const [period, setPeriod] = useState<Period>("6m");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [allAppointments, setAllAppointments] = useState<AppointmentRow[]>([]);
  const [newClientCount, setNewClientCount] = useState(0);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [artistAppts, setArtistAppts] = useState<ArtistApptRow[]>([]);
  const [upcomingArtistAppts, setUpcomingArtistAppts] = useState<{ artist_id: number }[]>([]);
  const [completedInPeriod, setCompletedInPeriod] = useState<CompletedTattooRow[]>([]);
  const [loading, setLoading] = useState(true);

  const today = toLocalDateStr(new Date());
  const effectiveStart = period === "custom" ? customFrom : getStartDate(period);
  const effectiveEnd   = period === "custom" ? customTo   : today;
  const isCustomReady  = period !== "custom" || (!!customFrom && !!customTo && customFrom <= customTo);

  useEffect(() => {
    if (!isCustomReady) return;
    setLoading(true);

    async function load() {
      const userId = await getUserId();
      if (!userId) { setLoading(false); return; }

      const [
        { data: inv },
        { data: appts },
        { data: clients },
        { data: reqs },
        { data: refs },
        { data: allAppts },
        { data: artAppts },
        { data: upcomingArtAppts },
        { data: completedData },
      ] = await Promise.all([
        supabase.from("invoices").select("id, amount, date, client_id, clients(name)").eq("user_id", userId).eq("status", "paid").gte("date", effectiveStart).lte("date", effectiveEnd),
        supabase.from("appointments").select("time, date, client_id, status").eq("user_id", userId).gte("date", effectiveStart).lte("date", effectiveEnd),
        supabase.from("clients").select("id").eq("user_id", userId).gte("created_at", effectiveStart).lte("created_at", effectiveEnd + "T23:59:59"),
        supabase.from("tattoo_requests").select("style, inquiry_type").eq("user_id", userId).gte("created_at", effectiveStart).lte("created_at", effectiveEnd + "T23:59:59"),
        supabase.from("tattoo_requests").select("referral_source").eq("user_id", userId).not("referral_source", "is", null).gte("created_at", effectiveStart).lte("created_at", effectiveEnd + "T23:59:59"),
        supabase.from("appointments").select("time, date, client_id, status").eq("user_id", userId),
        supabase.from("appointments").select("artist_id, type, date, client_id, artists(id, name, avatar_url)").eq("user_id", userId).gte("date", effectiveStart).lte("date", effectiveEnd).not("artist_id", "is", null),
        supabase.from("appointments").select("artist_id").eq("user_id", userId).gte("date", today).not("artist_id", "is", null),
        supabase.from("completed_tattoos").select("style, session_date, client_id").eq("user_id", userId).gte("session_date", effectiveStart).lte("session_date", effectiveEnd),
      ]);

      setInvoices((inv as unknown as Invoice[]) ?? []);
      setAppointments((appts as unknown as AppointmentRow[]) ?? []);
      setAllAppointments((allAppts as unknown as AppointmentRow[]) ?? []);
      setNewClientCount((clients ?? []).length);
      setRequests((reqs as RequestRow[]) ?? []);
      setReferrals((refs as ReferralRow[]) ?? []);
      setArtistAppts((artAppts as unknown as ArtistApptRow[]) ?? []);
      setUpcomingArtistAppts((upcomingArtAppts as unknown as { artist_id: number }[]) ?? []);
      setCompletedInPeriod((completedData as unknown as CompletedTattooRow[]) ?? []);
      setLoading(false);
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customFrom, customTo]);

  // ── Computed ─────────────────────────────────────────────────────────────────

  const totalRevenue   = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalSessions  = appointments.length;
  const avgPerSession  = invoices.length > 0 ? totalRevenue / invoices.length : 0;

  // Retention: from all-time appointments, clients with 2+ completed / clients with 1+
  const completedByClient: Record<string, number> = {};
  for (const a of allAppointments) {
    if (a.status === "completed" && a.client_id) {
      completedByClient[a.client_id] = (completedByClient[a.client_id] ?? 0) + 1;
    }
  }
  const clientsWith1Plus  = Object.values(completedByClient).filter((n) => n >= 1).length;
  const clientsWith2Plus  = Object.values(completedByClient).filter((n) => n >= 2).length;
  const retentionRate     = clientsWith1Plus > 0 ? (clientsWith2Plus / clientsWith1Plus) * 100 : 0;

  // New vs returning clients in period
  const periodClientIds  = new Set(appointments.map((a) => a.client_id).filter(Boolean));
  const preperiodClients = new Set(allAppointments.filter((a) => a.date < effectiveStart && a.client_id).map((a) => a.client_id));
  let returningCount = 0;
  let newThisPeriod  = 0;
  for (const id of periodClientIds) {
    if (preperiodClients.has(id)) returningCount++;
    else newThisPeriod++;
  }

  // Flash vs custom
  const flashCount  = requests.filter((r) => r.inquiry_type?.toLowerCase() === "flash").length;
  const customCount = requests.filter((r) => r.inquiry_type?.toLowerCase() === "custom" || !r.inquiry_type).length;
  const totalInqType = flashCount + customCount || 1;
  const flashPct  = Math.round((flashCount / totalInqType) * 100);
  const customPct = Math.round((customCount / totalInqType) * 100);

  let periodLabel: string;
  if (period === "custom") {
    if (customFrom && customTo) {
      const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const year = new Date(customTo + "T00:00:00").getFullYear();
      periodLabel = `${fmtDate(customFrom)} – ${fmtDate(customTo)}, ${year}`;
    } else {
      periodLabel = "Custom range";
    }
  } else {
    periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "";
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 space-y-6">

      {/* Header + period selector */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--nb-text)]">Analytics</h1>
          <p className="mt-1 text-sm text-[var(--nb-text-2)]">Track revenue, sessions, and client trends</p>
        </div>
        <div className="flex items-start gap-3 shrink-0">
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">From</label>
                <input type="date" value={customFrom} max={customTo || today} onChange={(e) => setCustomFrom(e.target.value)} className={DATE_INPUT_CLS} />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">To</label>
                <input type="date" value={customTo} min={customFrom || undefined} max={today} onChange={(e) => setCustomTo(e.target.value)} className={DATE_INPUT_CLS} />
              </div>
            </div>
          )}
          <div className="space-y-1">
            {period === "custom" && <div className="h-4" />}
            <div className="relative">
              <select
                value={period}
                onChange={(e) => { setPeriod(e.target.value as Period); if (e.target.value !== "custom") { setCustomFrom(""); setCustomTo(""); } }}
                className="appearance-none pl-4 pr-8 py-2 text-sm font-medium bg-[var(--nb-card)] border border-[var(--nb-border)] rounded-lg text-[var(--nb-text)] cursor-pointer focus:outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors shadow-sm h-9"
              >
                {PERIOD_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--nb-text-2)] pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Core stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Total Revenue" value={format(totalRevenue)} sub={periodLabel} icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600" loading={loading} />
        <StatCard label="Avg per Session" value={format(avgPerSession)} sub={totalSessions > 0 ? `over ${totalSessions} sessions` : "no sessions yet"} icon={Clock} iconBg="bg-[var(--nb-active-bg)]" iconColor="text-[#7C3AED]" loading={loading} />
        <StatCard label="Total Sessions" value={String(totalSessions)} sub={periodLabel} icon={Users} iconBg="bg-violet-50" iconColor="text-violet-600" loading={loading} />
        <StatCard label="New Clients" value={String(newClientCount)} sub={periodLabel} icon={UserPlus} iconBg="bg-amber-50" iconColor="text-amber-600" loading={loading} />
      </div>

      {/* Row 2: Retention + New/Returning + Flash/Custom */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Retention Rate"
          value={`${retentionRate.toFixed(1)}%`}
          sub={clientsWith1Plus > 0 ? `${clientsWith2Plus} of ${clientsWith1Plus} clients returned` : "no completed sessions yet"}
          icon={UserCheck}
          iconBg="bg-teal-50"
          iconColor="text-teal-600"
          loading={loading}
          highlight={retentionRate >= 50}
        />
        <StatCard
          label="New this Period"
          value={String(newThisPeriod)}
          sub="first-time clients"
          icon={UserPlus}
          iconBg="bg-sky-50"
          iconColor="text-sky-600"
          loading={loading}
        />
        <StatCard
          label="Returning"
          value={String(returningCount)}
          sub="repeat clients"
          icon={RefreshCw}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          loading={loading}
        />
        <div className={`rounded-xl border px-5 py-5 shadow-sm bg-[var(--nb-card)] border-[var(--nb-border)]`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="size-9 rounded-lg flex items-center justify-center shrink-0 bg-amber-50">
              <Zap size={17} className="text-amber-600" />
            </div>
            <p className="text-xs font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">Flash vs Custom</p>
          </div>
          <div className={`flex items-end gap-3 transition-opacity ${loading ? "opacity-30" : ""}`}>
            <div>
              <p className="text-2xl font-semibold text-[var(--nb-text)] leading-none">{flashPct}%</p>
              <p className="text-[11px] text-[var(--nb-text-2)] mt-1">Flash ({flashCount})</p>
            </div>
            <div className="text-[var(--nb-text-2)] text-lg mb-0.5">/</div>
            <div>
              <p className="text-2xl font-semibold text-[#7C3AED] leading-none">{customPct}%</p>
              <p className="text-[11px] text-[var(--nb-text-2)] mt-1">Custom ({customCount})</p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Over Time + Busiest Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5">
        <div className="lg:col-span-3 bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-[var(--nb-text)]">Revenue Over Time</h2>
            <span className="text-xs text-[var(--nb-text-2)]">{periodLabel}</span>
          </div>
          {isCustomReady ? (
            <RevenueChart invoices={invoices} appointments={appointments} start={effectiveStart} end={effectiveEnd} loading={loading} />
          ) : (
            <p className="text-sm text-[var(--nb-text-2)] py-10 text-center">Select a date range to view revenue</p>
          )}
        </div>
        <div className="lg:col-span-2 bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-[var(--nb-text)]">Busiest Hours</h2>
            <span className="text-xs text-[var(--nb-text-2)]">all time</span>
          </div>
          <BusiestHours appointments={allAppointments} loading={loading} />
        </div>
      </div>

      {/* Busiest Months + Busiest Days */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <ChartCard title="Busiest Months" badge="all time — top 3 highlighted">
          <BusiestMonths appointments={allAppointments} loading={loading} />
        </ChartCard>
        <ChartCard title="Busiest Days of Week" badge="all time">
          <BusiestDays appointments={allAppointments} loading={loading} />
        </ChartCard>
      </div>

      {/* Revenue by Style */}
      <ChartCard title="Revenue by Style" badge={`${completedInPeriod.length} completed tattoos · ${periodLabel}`}>
        <RevenueByStyle completedTattoos={completedInPeriod} avgTicket={avgPerSession} loading={loading} />
      </ChartCard>

      {/* Top Clients + Popular Styles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <ChartCard title="Top Clients by Spend" badge="paid invoices">
          <TopClients invoices={invoices} loading={loading} />
        </ChartCard>
        <ChartCard title="Most Popular Styles" badge={`${requests.length} requests`}>
          <PopularStyles requests={requests} loading={loading} />
        </ChartCard>
      </div>

      {/* Referral Sources */}
      <ChartCard title="Referral Sources" badge={periodLabel}>
        <ReferralSources referrals={referrals} loading={loading} />
      </ChartCard>

      {/* Artist Performance */}
      <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-[var(--nb-text)]">Artist Performance</h2>
            <p className="text-xs text-[var(--nb-text-2)] mt-0.5">Revenue matched by appointment date + client</p>
          </div>
          <span className="text-xs text-[var(--nb-text-2)]">{periodLabel}</span>
        </div>
        <ArtistPerformance artistAppts={artistAppts} upcomingArtistAppts={upcomingArtistAppts} invoices={invoices} loading={loading} />
      </div>

    </div>
  );
}
