"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  Clock,
  Users,
  UserPlus,
  ChevronDown,
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

type AppointmentRow = { time: string; date: string };
type RequestRow = { style: string };
type ArtistApptRow = {
  artist_id: number | null;
  type: string;
  date: string;
  artists: { id: number; name: string; avatar_url: string | null } | null;
};

// ─── Period helpers ───────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "month", label: "This month" },
  { value: "3m", label: "Past 3 months" },
  { value: "6m", label: "Past 6 months" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getStartDate(period: Exclude<Period, "custom">): string {
  const now = new Date();
  if (period === "month")
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  if (period === "year") return `${now.getFullYear()}-01-01`;
  const d = new Date(now);
  d.setMonth(d.getMonth() - (period === "3m" ? 3 : 6));
  return toLocalDateStr(d);
}

/** Monthly x-axis buckets for the revenue chart, derived from explicit date range. */
function getMonthBuckets(startStr: string, endStr: string) {
  const cur = new Date(startStr + "T00:00:00");
  cur.setDate(1);
  const endMonth = new Date(endStr + "T00:00:00");
  endMonth.setDate(1);
  const buckets = [];
  while (cur <= endMonth) {
    buckets.push({
      year: cur.getFullYear(),
      month: cur.getMonth(),
      label: cur.toLocaleDateString("en-US", { month: "short" }),
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return buckets;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatHour(h: number) {
  if (h === 0) return "12 AM";
  if (h < 12) return `${h} AM`;
  if (h === 12) return "12 PM";
  return `${h - 12} PM`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  iconColor,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  loading: boolean;
}) {
  return (
    <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] px-5 py-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}
        >
          <Icon size={17} className={iconColor} />
        </div>
        <p className="text-xs font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p
        className={`text-2xl font-semibold text-[var(--nb-text)] transition-opacity ${loading ? "opacity-30" : ""}`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-[var(--nb-text-2)] mt-1">{sub}</p>}
    </div>
  );
}

// ─── Revenue Chart (vertical CSS bars) ───────────────────────────────────────

function RevenueChart({
  invoices,
  start,
  end,
  loading,
}: {
  invoices: Invoice[];
  start: string;
  end: string;
  loading: boolean;
}) {
  const { format, formatShort } = useCurrency();
  const buckets = getMonthBuckets(start, end);

  const data = buckets.map(({ year, month, label }) => {
    const total = invoices
      .filter((inv) => {
        const d = new Date(inv.date + "T00:00:00");
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .reduce((sum, inv) => sum + inv.amount, 0);
    return { label, total };
  });

  const max = Math.max(...data.map((d) => d.total), 1);
  const CHART_H = 160; // px

  return (
    <div
      className={`transition-opacity ${loading ? "opacity-40" : ""}`}
    >
      {/* Y-axis grid + bars */}
      <div className="relative" style={{ height: CHART_H + 28 }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <div
            key={frac}
            className="absolute inset-x-0 border-t border-dashed border-[var(--nb-card)] flex items-start"
            style={{ top: CHART_H - frac * CHART_H }}
          >
            <span className="text-[10px] text-[var(--nb-text-2)] pr-2 -mt-2.5 select-none">
              {formatShort(max * frac)}
            </span>
          </div>
        ))}

        {/* Bars row */}
        <div
          className="absolute bottom-7 inset-x-0 flex items-end gap-2"
          style={{ height: CHART_H }}
        >
          {data.map(({ label, total }, i) => {
            const barH = Math.max((total / max) * CHART_H, total > 0 ? 4 : 2);
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-0 group relative"
              >
                {/* Tooltip */}
                {total > 0 && (
                  <div className="absolute bottom-full mb-2 bg-[var(--nb-bg)] text-white text-[10px] font-medium px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                    {format(total)}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                  </div>
                )}
                <div
                  className={`w-full rounded-t-md transition-all duration-300 ${
                    total > 0 ? "bg-[#7C3AED]" : "bg-[var(--nb-card)]"
                  }`}
                  style={{ height: barH }}
                />
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="absolute bottom-0 inset-x-0 flex gap-2">
          {data.map(({ label }, i) => (
            <div key={i} className="flex-1 text-center">
              <span className="text-[11px] text-[var(--nb-text-2)] select-none">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Busiest Hours (horizontal CSS bars) ─────────────────────────────────────

function BusiestHours({
  appointments,
  loading,
}: {
  appointments: AppointmentRow[];
  loading: boolean;
}) {
  const counts: Record<number, number> = {};
  for (const appt of appointments) {
    const hour = parseInt(appt.time.split(":")[0], 10);
    if (!isNaN(hour) && hour >= 8 && hour <= 20) {
      counts[hour] = (counts[hour] ?? 0) + 1;
    }
  }

  // Show hours 9–20 (9 AM to 8 PM)
  const hours = Array.from({ length: 12 }, (_, i) => i + 9);
  const max = Math.max(...hours.map((h) => counts[h] ?? 0), 1);
  const hasData = hours.some((h) => (counts[h] ?? 0) > 0);

  if (!loading && !hasData) {
    return (
      <p className="text-sm text-[var(--nb-text-2)] py-6 text-center">No appointments yet</p>
    );
  }

  return (
    <div
      className={`space-y-2 transition-opacity ${loading ? "opacity-40" : ""}`}
    >
      {hours.map((h) => {
        const count = counts[h] ?? 0;
        const pct = (count / max) * 100;
        return (
          <div key={h} className="flex items-center gap-2.5">
            <span className="text-[11px] text-[var(--nb-text-2)] w-11 shrink-0 text-right tabular-nums">
              {formatHour(h)}
            </span>
            <div className="flex-1 h-5 bg-[var(--nb-bg)] rounded-md overflow-hidden">
              <div
                className="h-full bg-[#7C3AED] rounded-md transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-[var(--nb-text-2)] w-4 shrink-0 tabular-nums">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Top Clients ──────────────────────────────────────────────────────────────

function TopClients({
  invoices,
  loading,
}: {
  invoices: Invoice[];
  loading: boolean;
}) {
  const { format } = useCurrency();
  const byClient: Record<string, { name: string; total: number }> = {};
  for (const inv of invoices) {
    if (!inv.client_id) continue;
    if (!byClient[inv.client_id]) {
      byClient[inv.client_id] = {
        name: inv.clients?.name ?? "Unknown",
        total: 0,
      };
    }
    byClient[inv.client_id].total += inv.amount;
  }

  const sorted = Object.values(byClient)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  const max = sorted[0]?.total ?? 1;

  if (!loading && sorted.length === 0) {
    return (
      <p className="text-sm text-[var(--nb-text-2)] py-6 text-center">No data yet</p>
    );
  }

  return (
    <div
      className={`space-y-4 transition-opacity ${loading ? "opacity-40" : ""}`}
    >
      {sorted.map(({ name, total }, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[var(--nb-text-2)] w-4 shrink-0 tabular-nums">
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-[var(--nb-text)] truncate">
                {name}
              </span>
              <span className="text-sm font-semibold text-[var(--nb-text)] ml-3 shrink-0 tabular-nums">
                {format(total)}
              </span>
            </div>
            <div className="h-1.5 bg-[var(--nb-bg)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#7C3AED] rounded-full transition-all duration-500"
                style={{ width: `${(total / max) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Popular Styles ───────────────────────────────────────────────────────────

const STYLE_COLORS = [
  "bg-[#7C3AED]",
  "bg-violet-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-emerald-400",
  "bg-indigo-400",
];

const EXCLUDED_STYLES = new Set(["reference", "null", "n/a", "other", ""]);

function PopularStyles({
  requests,
  loading,
}: {
  requests: RequestRow[];
  loading: boolean;
}) {
  const counts: Record<string, number> = {};
  for (const r of requests) {
    const style = r.style?.trim() ?? "";
    if (style && !EXCLUDED_STYLES.has(style.toLowerCase())) {
      counts[style] = (counts[style] ?? 0) + 1;
    }
  }

  const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
  const sorted = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  if (!loading && sorted.length === 0) {
    return (
      <p className="text-sm text-[var(--nb-text-2)] py-6 text-center">No data yet</p>
    );
  }

  return (
    <div
      className={`space-y-4 transition-opacity ${loading ? "opacity-40" : ""}`}
    >
      {sorted.map(([style, count], i) => {
        const pct = Math.round((count / total) * 100);
        const color = STYLE_COLORS[i % STYLE_COLORS.length];
        return (
          <div key={style} className="flex items-center gap-3">
            <div
              className={`size-2.5 rounded-full shrink-0 mt-0.5 ${color}`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-[var(--nb-text)] truncate">
                  {style}
                </span>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <span className="text-xs font-semibold text-[var(--nb-text-2)] tabular-nums">
                    {pct}%
                  </span>
                  <span className="text-xs text-[var(--nb-text-2)] tabular-nums">
                    ({count})
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-[var(--nb-bg)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Artist Performance ───────────────────────────────────────────────────────

const ARTIST_AVATAR_COLORS = [
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-sky-100", text: "text-sky-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
];

function getArtistColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return ARTIST_AVATAR_COLORS[Math.abs(hash) % ARTIST_AVATAR_COLORS.length];
}

function ArtistPerformance({
  artistAppts,
  upcomingArtistAppts,
  loading,
}: {
  artistAppts: ArtistApptRow[];
  upcomingArtistAppts: { artist_id: number }[];
  loading: boolean;
}) {
  // Aggregate per artist
  const map: Record<number, { name: string; avatar_url: string | null; sessions: number; types: Record<string, number> }> = {};
  for (const row of artistAppts) {
    if (!row.artist_id || !row.artists) continue;
    if (!map[row.artist_id]) {
      map[row.artist_id] = { name: row.artists.name, avatar_url: row.artists.avatar_url, sessions: 0, types: {} };
    }
    map[row.artist_id].sessions += 1;
    const t = row.type ?? "Other";
    map[row.artist_id].types[t] = (map[row.artist_id].types[t] ?? 0) + 1;
  }

  const upcomingByArtist: Record<number, number> = {};
  for (const row of upcomingArtistAppts) {
    upcomingByArtist[row.artist_id] = (upcomingByArtist[row.artist_id] ?? 0) + 1;
  }

  const rows = Object.entries(map)
    .map(([id, v]) => {
      const topType = Object.entries(v.types).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "—";
      return { id: Number(id), ...v, topType, upcoming: upcomingByArtist[Number(id)] ?? 0 };
    })
    .sort((a, b) => b.sessions - a.sessions);

  if (!loading && rows.length === 0) {
    return (
      <p className="text-sm text-[var(--nb-text-2)] py-6 text-center">
        No artist data yet — assign artists to appointments to see performance
      </p>
    );
  }

  return (
    <div className={`transition-opacity ${loading ? "opacity-40" : ""}`}>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--nb-border)]">
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">Artist</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">Sessions</th>
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
                        <span className={`size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${color.bg} ${color.text}`}>
                          {initials}
                        </span>
                      )}
                      <span className="font-medium text-[var(--nb-text)]">{row.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-[var(--nb-text)]">{row.sessions}</td>
                  <td className="py-3 px-3 text-right text-[var(--nb-text-2)]">{row.upcoming}</td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center rounded-full bg-[var(--nb-active-bg)] px-2.5 py-0.5 text-xs font-medium text-[#7C3AED]">
                      {row.topType}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
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
                <span className={`size-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${color.bg} ${color.text}`}>
                  {initials}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--nb-text)] truncate">{row.name}</p>
                <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                  {row.sessions} sessions · {row.upcoming} upcoming
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center rounded-full bg-[var(--nb-active-bg)] px-2.5 py-0.5 text-xs font-medium text-[#7C3AED]">
                {row.topType}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

const DATE_INPUT_CLS =
  "h-9 w-full rounded-lg border border-[var(--nb-border)] bg-[var(--nb-card)] px-3 text-sm text-[var(--nb-text)] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors";

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
  const [artistAppts, setArtistAppts] = useState<ArtistApptRow[]>([]);
  const [upcomingArtistAppts, setUpcomingArtistAppts] = useState<{ artist_id: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const today = toLocalDateStr(new Date());

  // Derive the effective date range for queries and chart
  const effectiveStart =
    period === "custom" ? customFrom : getStartDate(period);
  const effectiveEnd = period === "custom" ? customTo : today;
  const isCustomReady =
    period !== "custom" ||
    (!!customFrom && !!customTo && customFrom <= customTo);

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
        { data: allAppts },
        { data: artAppts },
        { data: upcomingArtAppts },
      ] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, amount, date, client_id, clients(name)")
          .eq("user_id", userId)
          .eq("status", "paid")
          .gte("date", effectiveStart)
          .lte("date", effectiveEnd),
        supabase
          .from("appointments")
          .select("time, date")
          .eq("user_id", userId)
          .gte("date", effectiveStart)
          .lte("date", effectiveEnd),
        supabase
          .from("clients")
          .select("id")
          .eq("user_id", userId)
          .gte("created_at", effectiveStart)
          .lte("created_at", effectiveEnd + "T23:59:59"),
        supabase
          .from("tattoo_requests")
          .select("style")
          .eq("user_id", userId)
          .gte("created_at", effectiveStart)
          .lte("created_at", effectiveEnd + "T23:59:59"),
        // All-time appointments for busiest hours (never period-filtered)
        supabase
          .from("appointments")
          .select("time, date")
          .eq("user_id", userId),
        // Artist appointments in period
        supabase
          .from("appointments")
          .select("artist_id, type, date, artists(id, name, avatar_url)")
          .eq("user_id", userId)
          .gte("date", effectiveStart)
          .lte("date", effectiveEnd)
          .not("artist_id", "is", null),
        // Upcoming artist appointments (all-time, for upcoming count)
        supabase
          .from("appointments")
          .select("artist_id")
          .eq("user_id", userId)
          .gte("date", today)
          .not("artist_id", "is", null),
      ]);

      setInvoices((inv as unknown as Invoice[]) ?? []);
      setAppointments((appts as AppointmentRow[]) ?? []);
      setAllAppointments((allAppts as AppointmentRow[]) ?? []);
      setNewClientCount((clients ?? []).length);
      setRequests((reqs as RequestRow[]) ?? []);
      setArtistAppts((artAppts as unknown as ArtistApptRow[]) ?? []);
      setUpcomingArtistAppts((upcomingArtAppts as unknown as { artist_id: number }[]) ?? []);
      setLoading(false);
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customFrom, customTo]);

  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalSessions = appointments.length;
  const avgPerSession = totalSessions > 0 ? totalRevenue / totalSessions : 0;

  // Human-readable label for stat card subtitles
  let periodLabel: string;
  if (period === "custom") {
    if (customFrom && customTo) {
      const fmtDate = (s: string) =>
        new Date(s + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      const year = new Date(customTo + "T00:00:00").getFullYear();
      periodLabel = `${fmtDate(customFrom)} – ${fmtDate(customTo)}, ${year}`;
    } else {
      periodLabel = "Custom range";
    }
  } else {
    periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "";
  }

  return (
    <div className="p-4 md:p-8 space-y-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--nb-text)]">Analytics</h1>
          <p className="mt-1 text-sm text-[var(--nb-text-2)]">
            Track revenue, sessions, and client trends
          </p>
        </div>

        {/* Period controls */}
        <div className="flex items-start gap-3 shrink-0">
          {/* Custom date inputs */}
          {period === "custom" && (
            <div className="flex items-center gap-2">
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">
                  From
                </label>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || today}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className={DATE_INPUT_CLS}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">
                  To
                </label>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  max={today}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className={DATE_INPUT_CLS}
                />
              </div>
            </div>
          )}

          {/* Period dropdown */}
          <div className="space-y-1">
            {period === "custom" && (
              <div className="h-4" /> /* spacer to align with date input labels */
            )}
            <div className="relative">
              <select
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value as Period);
                  if (e.target.value !== "custom") {
                    setCustomFrom("");
                    setCustomTo("");
                  }
                }}
                className="appearance-none pl-4 pr-8 py-2 text-sm font-medium bg-[var(--nb-card)] border border-[var(--nb-border)] rounded-lg text-[var(--nb-text)] cursor-pointer focus:outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors shadow-sm h-9"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--nb-text-2)] pointer-events-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <StatCard
          label="Total Revenue"
          value={format(totalRevenue)}
          sub={periodLabel}
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          loading={loading}
        />
        <StatCard
          label="Avg. per Session"
          value={format(avgPerSession)}
          sub={totalSessions > 0 ? `over ${totalSessions} sessions` : "no sessions yet"}
          icon={Clock}
          iconBg="bg-[var(--nb-active-bg)]"
          iconColor="text-[#7C3AED]"
          loading={loading}
        />
        <StatCard
          label="Total Sessions"
          value={String(totalSessions)}
          sub={periodLabel}
          icon={Users}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          loading={loading}
        />
        <StatCard
          label="New Clients"
          value={String(newClientCount)}
          sub={periodLabel}
          icon={UserPlus}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          loading={loading}
        />
      </div>

      {/* Charts row: Revenue (wider) + Busiest hours */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-5">
        <div className="lg:col-span-3 bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-[var(--nb-text)]">
              Revenue Over Time
            </h2>
            <span className="text-xs text-[var(--nb-text-2)]">{periodLabel}</span>
          </div>
          {isCustomReady ? (
            <RevenueChart
              invoices={invoices}
              start={effectiveStart}
              end={effectiveEnd}
              loading={loading}
            />
          ) : (
            <p className="text-sm text-[var(--nb-text-2)] py-10 text-center">
              Select a date range to view revenue
            </p>
          )}
        </div>

        <div className="lg:col-span-2 bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-[var(--nb-text)]">
              Busiest Hours
            </h2>
            <span className="text-xs text-[var(--nb-text-2)]">all time</span>
          </div>
          <BusiestHours appointments={allAppointments} loading={loading} />
        </div>
      </div>

      {/* Bottom row: Top clients + Popular styles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-[var(--nb-text)]">
              Top Clients by Spend
            </h2>
            <span className="text-xs text-[var(--nb-text-2)]">paid invoices</span>
          </div>
          <TopClients invoices={invoices} loading={loading} />
        </div>

        <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-[var(--nb-text)]">
              Most Popular Styles
            </h2>
            <span className="text-xs text-[var(--nb-text-2)]">
              {requests.length} requests
            </span>
          </div>
          <PopularStyles requests={requests} loading={loading} />
        </div>
      </div>

      {/* Artist Performance */}
      <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-[var(--nb-text)]">
            Artist Performance
          </h2>
          <span className="text-xs text-[var(--nb-text-2)]">{periodLabel}</span>
        </div>
        <ArtistPerformance
          artistAppts={artistAppts}
          upcomingArtistAppts={upcomingArtistAppts}
          loading={loading}
        />
      </div>
    </div>
  );
}
