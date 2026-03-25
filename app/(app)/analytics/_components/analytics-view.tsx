"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  Clock,
  Users,
  UserPlus,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "6m" | "month" | "year";

type Invoice = {
  id: string;
  amount: number;
  date: string;
  client_id: string;
  clients: { name: string } | null;
};

type AppointmentRow = { time: string; date: string };
type RequestRow = { style: string };

// ─── Period helpers ───────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "6m", label: "Last 6 months" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getStartDate(period: Period): string {
  const now = new Date();
  if (period === "month")
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  if (period === "year") return `${now.getFullYear()}-01-01`;
  const d = new Date(now);
  d.setMonth(d.getMonth() - 6);
  return toLocalDateStr(d);
}

/** Monthly x-axis buckets for the revenue chart */
function getMonthBuckets(period: Period) {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();

  if (period === "6m") {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(curYear, curMonth - 5 + i);
      return {
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleDateString("en-US", { month: "short" }),
      };
    });
  }
  if (period === "month") {
    return [
      {
        year: curYear,
        month: curMonth,
        label: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      },
    ];
  }
  // year → Jan … current month
  return Array.from({ length: curMonth + 1 }, (_, i) => {
    const d = new Date(curYear, i);
    return {
      year: curYear,
      month: i,
      label: d.toLocaleDateString("en-US", { month: "short" }),
    };
  });
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtShort(n: number) {
  if (n >= 1000) return `$${+(n / 1000).toFixed(1)}k`;
  return `$${n}`;
}

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
    <div className="bg-white rounded-xl border border-[#D6EAF0] px-5 py-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}
        >
          <Icon size={17} className={iconColor} />
        </div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p
        className={`text-2xl font-semibold text-gray-900 transition-opacity ${loading ? "opacity-30" : ""}`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Revenue Chart (vertical CSS bars) ───────────────────────────────────────

function RevenueChart({
  invoices,
  period,
  loading,
}: {
  invoices: Invoice[];
  period: Period;
  loading: boolean;
}) {
  const buckets = getMonthBuckets(period);

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
            className="absolute inset-x-0 border-t border-dashed border-[#EEF5F8] flex items-start"
            style={{ top: CHART_H - frac * CHART_H }}
          >
            <span className="text-[10px] text-gray-300 pr-2 -mt-2.5 select-none">
              {fmtShort(max * frac)}
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
                  <div className="absolute bottom-full mb-2 bg-gray-900 text-white text-[10px] font-medium px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                    {fmt(total)}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
                  </div>
                )}
                <div
                  className={`w-full rounded-t-md transition-all duration-300 ${
                    total > 0 ? "bg-[#1A8FAF]" : "bg-[#EEF5F8]"
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
              <span className="text-[11px] text-gray-400 select-none">
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

  // Show hours 9–18, sorted by count descending for display order
  const hours = Array.from({ length: 10 }, (_, i) => i + 9);
  const max = Math.max(...hours.map((h) => counts[h] ?? 0), 1);

  return (
    <div
      className={`space-y-2 transition-opacity ${loading ? "opacity-40" : ""}`}
    >
      {hours.map((h) => {
        const count = counts[h] ?? 0;
        const pct = (count / max) * 100;
        return (
          <div key={h} className="flex items-center gap-2.5">
            <span className="text-[11px] text-gray-400 w-11 shrink-0 text-right tabular-nums">
              {formatHour(h)}
            </span>
            <div className="flex-1 h-5 bg-[#F0F7FA] rounded-md overflow-hidden">
              <div
                className="h-full bg-[#1A8FAF] rounded-md transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-gray-500 w-4 shrink-0 tabular-nums">
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
      <p className="text-sm text-gray-400 py-6 text-center">No data yet</p>
    );
  }

  return (
    <div
      className={`space-y-4 transition-opacity ${loading ? "opacity-40" : ""}`}
    >
      {sorted.map(({ name, total }, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-300 w-4 shrink-0 tabular-nums">
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gray-800 truncate">
                {name}
              </span>
              <span className="text-sm font-semibold text-gray-900 ml-3 shrink-0 tabular-nums">
                {fmt(total)}
              </span>
            </div>
            <div className="h-1.5 bg-[#F0F7FA] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1A8FAF] rounded-full transition-all duration-500"
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
  "bg-[#1A8FAF]",
  "bg-violet-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-emerald-400",
  "bg-indigo-400",
];

function PopularStyles({
  requests,
  loading,
}: {
  requests: RequestRow[];
  loading: boolean;
}) {
  const counts: Record<string, number> = {};
  for (const r of requests) {
    if (r.style) counts[r.style] = (counts[r.style] ?? 0) + 1;
  }

  const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
  const sorted = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  if (!loading && sorted.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-6 text-center">No data yet</p>
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
                <span className="text-sm font-medium text-gray-800 truncate">
                  {style}
                </span>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <span className="text-xs font-semibold text-gray-500 tabular-nums">
                    {pct}%
                  </span>
                  <span className="text-xs text-gray-300 tabular-nums">
                    ({count})
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-[#F0F7FA] rounded-full overflow-hidden">
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

// ─── Main view ────────────────────────────────────────────────────────────────

export function AnalyticsView() {
  const [period, setPeriod] = useState<Period>("6m");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [newClientCount, setNewClientCount] = useState(0);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const start = getStartDate(period);

    Promise.all([
      supabase
        .from("invoices")
        .select("id, amount, date, client_id, clients(name)")
        .eq("status", "paid")
        .gte("date", start),
      supabase
        .from("appointments")
        .select("time, date")
        .gte("date", start),
      supabase
        .from("clients")
        .select("id")
        .gte("created_at", start),
      supabase
        .from("tattoo_requests")
        .select("style")
        .gte("created_at", start),
    ]).then(
      ([
        { data: inv },
        { data: appts },
        { data: clients },
        { data: reqs },
      ]) => {
        setInvoices((inv as Invoice[]) ?? []);
        setAppointments((appts as AppointmentRow[]) ?? []);
        setNewClientCount((clients ?? []).length);
        setRequests((reqs as RequestRow[]) ?? []);
        setLoading(false);
      }
    );
  }, [period]);

  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalSessions = appointments.length;
  const avgPerSession = totalSessions > 0 ? totalRevenue / totalSessions : 0;

  const currentPeriodLabel =
    PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "";

  return (
    <div className="p-8 space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track revenue, sessions, and client trends
          </p>
        </div>

        {/* Period selector */}
        <div className="relative">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="appearance-none pl-4 pr-8 py-2 text-sm font-medium bg-white border border-[#D6EAF0] rounded-lg text-gray-700 cursor-pointer focus:outline-none focus:border-[#1A8FAF] focus:ring-2 focus:ring-[#1A8FAF]/20 transition-colors shadow-sm"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-5">
        <StatCard
          label="Total Revenue"
          value={fmt(totalRevenue)}
          sub={currentPeriodLabel}
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          loading={loading}
        />
        <StatCard
          label="Avg. per Session"
          value={fmt(avgPerSession)}
          sub={totalSessions > 0 ? `over ${totalSessions} sessions` : "no sessions yet"}
          icon={Clock}
          iconBg="bg-[#E8F5FA]"
          iconColor="text-[#1A8FAF]"
          loading={loading}
        />
        <StatCard
          label="Total Sessions"
          value={String(totalSessions)}
          sub={currentPeriodLabel}
          icon={Users}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          loading={loading}
        />
        <StatCard
          label="New Clients"
          value={String(newClientCount)}
          sub={currentPeriodLabel}
          icon={UserPlus}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          loading={loading}
        />
      </div>

      {/* Charts row: Revenue (wider) + Busiest hours */}
      <div className="grid grid-cols-5 gap-5">
        <div className="col-span-3 bg-white rounded-xl border border-[#D6EAF0] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-800">
              Revenue Over Time
            </h2>
            <span className="text-xs text-gray-400">{currentPeriodLabel}</span>
          </div>
          <RevenueChart invoices={invoices} period={period} loading={loading} />
        </div>

        <div className="col-span-2 bg-white rounded-xl border border-[#D6EAF0] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-800">
              Busiest Hours
            </h2>
            <span className="text-xs text-gray-400">by appointment count</span>
          </div>
          <BusiestHours appointments={appointments} loading={loading} />
        </div>
      </div>

      {/* Bottom row: Top clients + Popular styles */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-[#D6EAF0] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-800">
              Top Clients by Spend
            </h2>
            <span className="text-xs text-gray-400">paid invoices</span>
          </div>
          <TopClients invoices={invoices} loading={loading} />
        </div>

        <div className="bg-white rounded-xl border border-[#D6EAF0] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-gray-800">
              Most Popular Styles
            </h2>
            <span className="text-xs text-gray-400">
              {requests.length} requests
            </span>
          </div>
          <PopularStyles requests={requests} loading={loading} />
        </div>
      </div>
    </div>
  );
}
