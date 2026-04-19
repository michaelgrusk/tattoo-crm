"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  FileText,
  DollarSign,
  Repeat2,
  Star,
  UserCheck,
  CalendarDays,
  CalendarX,
  Timer,
  MessageCircleX,
  Zap,
  Copy,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Users,
  UserPlus,
  Percent,
  Shield,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { supabase, getUserId } from "@/lib/supabase/client";
import { useCurrency } from "@/components/currency-provider";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "month" | "3m" | "6m" | "year";

type PaidInvoice     = { amount: number; client_id: string };
type DepositInvoice  = { amount: number };
type Appointment     = { id: string; date: string; client_id: string; status: string };
type Request         = { id: string; status: string; created_at: string; inquiry_type: string | null };

// ─── Period helpers ───────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { value: Period; label: string; months: number }[] = [
  { value: "month", label: "This month",    months: 1  },
  { value: "3m",    label: "Past 3 months", months: 3  },
  { value: "6m",    label: "Past 6 months", months: 6  },
  { value: "year",  label: "This year",     months: 12 },
];

function pad(n: number) { return String(n).padStart(2, "0"); }

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getDateRange(period: Period) {
  const now = new Date();
  const end = toLocalDateStr(now);
  const opt = PERIOD_OPTIONS.find((o) => o.value === period)!;
  if (period === "month") {
    return { start: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, end, months: 1 };
  }
  if (period === "year") {
    return { start: `${now.getFullYear()}-01-01`, end, months: 12 };
  }
  const d = new Date(now);
  d.setMonth(d.getMonth() - opt.months);
  return { start: toLocalDateStr(d), end, months: opt.months };
}

// ─── Small shared components ──────────────────────────────────────────────────

function SectionHeading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xs font-semibold text-[var(--nb-text-2)] uppercase tracking-wider">
        {children}
      </h2>
      {sub && <p className="text-xs text-[var(--nb-text-2)] mt-0.5 font-normal">{sub}</p>}
    </div>
  );
}

function StudioStatCard({
  label, value, sub, icon: Icon, iconBg, iconColor, loading,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; iconBg: string; iconColor: string; loading: boolean;
}) {
  return (
    <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2.5">
        <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={15} className={iconColor} />
        </div>
        <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide leading-tight">
          {label}
        </p>
      </div>
      <p className={`text-xl font-semibold text-[var(--nb-text)] leading-none transition-opacity ${loading ? "opacity-30" : ""}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-[var(--nb-text-2)] mt-1">{sub}</p>}
    </div>
  );
}

// Admin hours visual bar card
function AdminHoursCard({
  totalHours, perMonth, loading,
}: {
  totalHours: number; perMonth: number; loading: boolean;
}) {
  const perYear = perMonth * 12;
  const maxVal = perYear;
  const bars = [
    { label: "Per Week",  value: perMonth / 4.33, pct: maxVal > 0 ? ((perMonth / 4.33) / maxVal) * 100 : 0, color: "bg-violet-300" },
    { label: "Per Month", value: perMonth,         pct: maxVal > 0 ? (perMonth / maxVal) * 100 : 0,         color: "bg-violet-500" },
    { label: "Per Year",  value: perYear,          pct: 100,                                                  color: "bg-[#7C3AED]" },
  ];
  return (
    <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] px-5 py-5 shadow-sm flex flex-col">
      <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-1">
        Admin Hours Saved
      </p>
      <p className={`text-2xl font-semibold text-[var(--nb-text)] leading-none mb-3 transition-opacity ${loading ? "opacity-30" : ""}`}>
        {Math.round(totalHours)}h
      </p>
      <div className={`space-y-2.5 transition-opacity ${loading ? "opacity-30" : ""}`}>
        {bars.map((b) => (
          <div key={b.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[var(--nb-text-2)] font-medium">{b.label}</span>
              <span className="text-[10px] font-semibold text-[var(--nb-text)] tabular-nums">
                {b.value.toFixed(1)}h
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--nb-border)] overflow-hidden">
              <div className={`h-full rounded-full ${b.color} transition-all`} style={{ width: `${b.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--nb-text-2)] mt-3">45 min saved per appointment</p>
    </div>
  );
}

function ValueCard({
  label, mainValue, sub, accent, loading,
}: {
  label: string; mainValue: string; sub?: string; accent?: string; loading: boolean;
}) {
  return (
    <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] px-5 py-5 shadow-sm flex flex-col">
      <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-2">
        {label}
      </p>
      <p className={`text-2xl font-semibold text-[var(--nb-text)] leading-none transition-opacity ${loading ? "opacity-30" : ""}`}>
        {mainValue}
      </p>
      {sub && <p className="text-xs text-[var(--nb-text-2)] mt-2 flex-1">{sub}</p>}
      {accent && (
        <p className="text-xs font-medium text-[#7C3AED] mt-2 border-t border-[var(--nb-border)] pt-2">
          {accent}
        </p>
      )}
    </div>
  );
}

function MoneyLeftCard({
  title, sub, icon: Icon, iconBg, iconColor,
  count, countColor, countNote, badge, badgeCls, tip, loading,
}: {
  title: string; sub: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
  count: string; countColor: string; countNote: string;
  badge?: string; badgeCls?: string;
  tip?: string;
  loading: boolean;
}) {
  return (
    <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] p-5 shadow-sm flex flex-col">
      <div className="flex items-start gap-3 mb-4">
        <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon size={17} className={iconColor} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--nb-text)]">{title}</p>
          <p className="text-xs text-[var(--nb-text-2)] mt-0.5">{sub}</p>
        </div>
      </div>
      <p className={`text-4xl font-bold ${countColor} leading-none mb-1 transition-opacity ${loading ? "opacity-30" : ""}`}>
        {count}
      </p>
      <p className="text-xs text-[var(--nb-text-2)] mb-auto">{countNote}</p>
      {badge && (
        <p className={`mt-3 text-xs font-medium rounded-lg px-3 py-1.5 ${badgeCls}`}>
          {badge}
        </p>
      )}
      {tip && (
        <div className="mt-3 pt-3 border-t border-[var(--nb-border)]">
          <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wider mb-1">How to recover this</p>
          <p className="text-xs text-[var(--nb-text)] leading-relaxed">{tip}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main ROI View ────────────────────────────────────────────────────────────

export function ROIView() {
  const { format } = useCurrency();
  const [period, setPeriod] = useState<Period>("6m");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [studioName, setStudioName] = useState("Your Studio");

  // Raw data state
  const [paidInvoices,    setPaidInvoices]    = useState<PaidInvoice[]>([]);
  const [depositInvoices, setDepositInvoices] = useState<DepositInvoice[]>([]);
  const [appointments,    setAppointments]    = useState<Appointment[]>([]);
  const [tattooRequests,  setTattooRequests]  = useState<Request[]>([]);
  const [allClientCount,  setAllClientCount]  = useState(0);
  const [allPaidInvoices, setAllPaidInvoices] = useState<{ client_id: string }[]>([]);
  const [intakeClientIds, setIntakeClientIds] = useState<Set<string>>(new Set());
  const [prevPeriodClientIds, setPrevPeriodClientIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const { start, end } = getDateRange(period);
    setLoading(true);

    async function load() {
      const userId = await getUserId();
      if (!userId) { setLoading(false); return; }

      const [
        authRes,
        paidRes,
        depositRes,
        apptRes,
        reqRes,
        clientRes,
        allPaidRes,
        allReqRes,
        prevApptRes,
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("invoices").select("amount, client_id")
          .eq("user_id", userId).eq("status", "paid")
          .gte("date", start).lte("date", end),
        supabase.from("invoices").select("amount")
          .eq("user_id", userId).eq("status", "deposit")
          .gte("date", start).lte("date", end),
        supabase.from("appointments").select("id, date, client_id, status")
          .eq("user_id", userId).gte("date", start).lte("date", end),
        supabase.from("tattoo_requests").select("id, status, created_at, inquiry_type")
          .eq("user_id", userId)
          .gte("created_at", start).lte("created_at", end + "T23:59:59"),
        supabase.from("clients").select("id").eq("user_id", userId),
        supabase.from("invoices").select("client_id")
          .eq("user_id", userId).eq("status", "paid"),
        supabase.from("tattoo_requests").select("client_id")
          .eq("user_id", userId).not("client_id", "is", null),
        // clients who had appointments BEFORE this period (for new vs returning)
        supabase.from("appointments").select("client_id")
          .eq("user_id", userId).lt("date", start),
      ]);

      const user = authRes.data?.user;
      setStudioName(user?.user_metadata?.studio_name ?? "Your Studio");
      setPaidInvoices((paidRes.data ?? []) as PaidInvoice[]);
      setDepositInvoices((depositRes.data ?? []) as DepositInvoice[]);
      setAppointments((apptRes.data ?? []) as Appointment[]);
      setTattooRequests((reqRes.data ?? []) as Request[]);
      setAllClientCount((clientRes.data ?? []).length);
      setAllPaidInvoices((allPaidRes.data ?? []) as { client_id: string }[]);
      setIntakeClientIds(
        new Set((allReqRes.data ?? []).map((r: any) => r.client_id as string))
      );
      setPrevPeriodClientIds(
        new Set((prevApptRes.data ?? []).map((r: any) => r.client_id as string))
      );
      setLoading(false);
    }

    load();
  }, [period]);

  // ── Computed metrics ──────────────────────────────────────────────────────

  const { months: periodMonths } = getDateRange(period);

  const totalRevenue   = paidInvoices.reduce((s, i) => s + i.amount, 0);
  const depositsTotal  = depositInvoices.reduce((s, i) => s + i.amount, 0);
  const apptCount      = appointments.length;
  const requestCount   = tattooRequests.length;
  const avgTicket      = paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0;

  // Conversion rate
  const completedCount = appointments.filter((a) => a.status === "completed").length;
  const conversionRate = requestCount > 0 ? (completedCount / requestCount) * 100 : 0;

  // Repeat client rate (all-time paid invoices)
  const paidPerClient: Record<string, number> = {};
  for (const inv of allPaidInvoices) {
    paidPerClient[inv.client_id] = (paidPerClient[inv.client_id] ?? 0) + 1;
  }
  const clientsWithInvoices = Object.keys(paidPerClient).length;
  const repeatCount = Object.values(paidPerClient).filter((n) => n > 1).length;
  const retentionRate = clientsWithInvoices > 0 ? (repeatCount / clientsWithInvoices) * 100 : 0;

  // New vs returning clients (period)
  const periodClientIds = new Set(appointments.map((a) => a.client_id).filter(Boolean));
  const newThisPeriod       = [...periodClientIds].filter((id) => !prevPeriodClientIds.has(id)).length;
  const returningThisPeriod = [...periodClientIds].filter((id) =>  prevPeriodClientIds.has(id)).length;

  // Flash vs Custom split from inquiry_type
  const flashCount = tattooRequests.filter((r) => r.inquiry_type === "flash").length;
  const customCount = tattooRequests.filter((r) => r.inquiry_type === "custom").length;
  const knownTypeCount = flashCount + customCount;
  const flashPct  = knownTypeCount > 0 ? (flashCount  / knownTypeCount) * 100 : 0;

  // Admin hours: 45 min per appointment
  const totalAdminHours = apptCount * 0.75;
  const adminPerMonth   = periodMonths > 0 ? totalAdminHours / periodMonths : totalAdminHours;

  // Revenue from reminders: 15% no-show protection
  const revenueFromReminders = Math.round(apptCount * 0.15 * avgTicket);

  // Deposit security rate (% of revenue secured by deposits)
  const depositSecurityRate = totalRevenue > 0 ? (depositsTotal / totalRevenue) * 100 : 0;

  // Lead response efficiency (% responded within 48h)
  const now48 = Date.now();
  const ms48h = 48 * 60 * 60 * 1000;
  const ms7d  = 7  * 24 * 60 * 60 * 1000;
  const respondedFast = tattooRequests.filter(
    (r) => r.status !== "new request" || now48 - new Date(r.created_at).getTime() < ms48h
  ).length;
  const responseEfficiency = requestCount > 0 ? (respondedFast / requestCount) * 100 : 100;

  // Conversion value: paid revenue from intake-sourced clients
  const conversionValue = Math.round(
    paidInvoices.filter((inv) => intakeClientIds.has(inv.client_id))
      .reduce((s, i) => s + i.amount, 0)
  );

  // Empty slots
  const weeksInPeriod   = (periodMonths * 365) / 12 / 7;
  const slotsPerWeek    = weeksInPeriod > 0 ? apptCount / weeksInPeriod : 0;
  const emptyPerWeek    = Math.max(0, 20 - slotsPerWeek); // 5 days × 4 slots
  const totalEmptySlots = Math.round(emptyPerWeek * weeksInPeriod);
  const potentialRevenue        = Math.round(totalEmptySlots * avgTicket);
  const potentialMonthlyRevenue = Math.round((totalEmptySlots / Math.max(1, periodMonths)) * avgTicket);

  // Slow leads & ghosted (within period)
  const slowLeads    = tattooRequests.filter(
    (r) => r.status === "new request" && now48 - new Date(r.created_at).getTime() > ms48h
  ).length;
  const ghostedLeads = tattooRequests.filter(
    (r) => r.status === "new request" && now48 - new Date(r.created_at).getTime() > ms7d
  ).length;

  // Revenue lost to slow leads
  const slowLeadLost  = Math.round(slowLeads  * (conversionRate / 100) * avgTicket);
  const ghostedLost   = Math.round(ghostedLeads * 0.5 * avgTicket);

  // Total opportunity cost
  const totalOpportunityCost = potentialRevenue + slowLeadLost + ghostedLost;

  // Pre-computed accent strings (avoids template-literal parsing issues in JSX)
  const remindersAccent = revenueFromReminders > 0
    ? format(Math.round(revenueFromReminders / Math.max(1, periodMonths))) + "/mo protected on average"
    : undefined;

  // Totals for summary card
  const totalValueRecovered = revenueFromReminders + depositsTotal + conversionValue;
  const intakeDrivenSessions = paidInvoices.filter((inv) => intakeClientIds.has(inv.client_id)).length;
  const depositCoveragePct   = totalRevenue > 0 ? (depositsTotal / totalRevenue) * 100 : 0;
  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? "";
  const summaryText = `In ${periodLabel.toLowerCase()}, Tatflow helped ${studioName} save ${Math.round(totalAdminHours)} hours of admin, collect ${format(depositsTotal)} in deposits, and recover an estimated ${format(Math.round(totalValueRecovered))} in revenue.`;

  function handleCopy() {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 space-y-10">

      {/* Header + period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--nb-text)]">ROI Calculator</h1>
          <p className="mt-1 text-sm text-[var(--nb-text-2)]">
            The real financial impact of Tatflow on your studio
          </p>
        </div>
        <div className="relative shrink-0">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="appearance-none pl-4 pr-8 h-9 text-sm font-medium bg-[var(--nb-card)] border border-[var(--nb-border)] rounded-lg text-[var(--nb-text)] cursor-pointer focus:outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors shadow-sm"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--nb-text-2)] pointer-events-none" />
        </div>
      </div>

      {/* ── 1. Studio Stats (8 cards, 2 rows) ────────────────────────────── */}
      <section>
        <SectionHeading sub={`Pulled from your Tatflow data — ${periodLabel.toLowerCase()}`}>
          Your Studio Stats
        </SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StudioStatCard
            label="Total Revenue"  value={format(Math.round(totalRevenue))}
            sub="paid invoices"    icon={TrendingUp}
            iconBg="bg-emerald-50" iconColor="text-emerald-600" loading={loading}
          />
          <StudioStatCard
            label="Sessions Completed" value={String(completedCount)}
            sub={periodLabel.toLowerCase()}    icon={CalendarDays}
            iconBg="bg-violet-50"              iconColor="text-violet-600" loading={loading}
          />
          <StudioStatCard
            label="Avg Ticket Value"  value={format(Math.round(avgTicket))}
            sub="per paid session"    icon={Star}
            iconBg="bg-rose-50"       iconColor="text-rose-600" loading={loading}
          />
          <StudioStatCard
            label="Client Retention"        value={`${retentionRate.toFixed(1)}%`}
            sub="clients with 2+ sessions"  icon={UserCheck}
            iconBg="bg-teal-50"             iconColor="text-teal-600" loading={loading}
          />
          <StudioStatCard
            label="New Clients"     value={String(newThisPeriod)}
            sub="first-time this period" icon={UserPlus}
            iconBg="bg-sky-50"       iconColor="text-sky-600" loading={loading}
          />
          <StudioStatCard
            label="Returning Clients" value={String(returningThisPeriod)}
            sub="came back this period"  icon={Users}
            iconBg="bg-[var(--nb-active-bg)]" iconColor="text-[#7C3AED]" loading={loading}
          />
          <StudioStatCard
            label="Conversion Rate"    value={`${conversionRate.toFixed(1)}%`}
            sub="requests → completed" icon={Repeat2}
            iconBg="bg-amber-50"       iconColor="text-amber-600" loading={loading}
          />
          <StudioStatCard
            label="Flash vs Custom"
            value={knownTypeCount > 0 ? `${flashPct.toFixed(0)}% / ${(100 - flashPct).toFixed(0)}%` : "—"}
            sub={knownTypeCount > 0 ? `${flashCount} flash · ${customCount} custom` : "no inquiry type data"}
            icon={Percent}
            iconBg="bg-orange-50" iconColor="text-orange-600" loading={loading}
          />
        </div>
      </section>

      {/* ── 2. Estimated Value Recovered ─────────────────────────────────── */}
      <section>
        <SectionHeading sub="Conservative estimates based on industry benchmarks">
          Estimated Value Recovered
        </SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Admin hours — visual bar card */}
          <AdminHoursCard
            totalHours={totalAdminHours}
            perMonth={adminPerMonth}
            loading={loading}
          />

          {/* No-show revenue */}
          <ValueCard
            label="Revenue from Reminders"
            mainValue={format(revenueFromReminders)}
            sub={`15% no-show rate × ${apptCount} appt${apptCount !== 1 ? "s" : ""} × ${format(Math.round(avgTicket))} avg ticket`}
            accent={remindersAccent}
            loading={loading}
          />

          {/* Deposit security rate */}
          <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] px-5 py-5 shadow-sm flex flex-col">
            <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-1">
              Deposit Security Rate
            </p>
            <p className={`text-2xl font-semibold text-[var(--nb-text)] leading-none mb-3 transition-opacity ${loading ? "opacity-30" : ""}`}>
              {format(Math.round(depositsTotal))}
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[var(--nb-text-2)]">Deposits / Total revenue</span>
                <span className="font-semibold text-[var(--nb-text)] tabular-nums">{depositSecurityRate.toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--nb-border)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{ width: `${Math.min(100, depositSecurityRate)}%` }}
                />
              </div>
              <p className="text-[10px] text-[var(--nb-text-2)]">
                {depositSecurityRate >= 20
                  ? "Strong deposit coverage"
                  : "Consider requiring deposits on all bookings"}
              </p>
            </div>
          </div>

          {/* Lead response efficiency */}
          <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] px-5 py-5 shadow-sm flex flex-col">
            <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-1">
              Lead Response Efficiency
            </p>
            <p className={`text-2xl font-semibold text-[var(--nb-text)] leading-none mb-3 transition-opacity ${loading ? "opacity-30" : ""}`}>
              {responseEfficiency.toFixed(0)}%
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-[var(--nb-text-2)]">Replied within 48h</span>
                <span className="font-semibold text-[var(--nb-text)] tabular-nums">
                  {respondedFast} / {requestCount}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--nb-border)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${responseEfficiency >= 80 ? "bg-emerald-500" : responseEfficiency >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, responseEfficiency)}%` }}
                />
              </div>
              <p className="text-[10px] text-[var(--nb-text-2)]">
                {responseEfficiency >= 80 ? "Great response rate" : "Faster replies → higher booking rates"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Money Left on the Table ───────────────────────────────────── */}
      <section>
        <SectionHeading sub="Opportunities to capture more revenue">
          Money Left on the Table
        </SectionHeading>

        {/* Opportunity cost total */}
        {totalOpportunityCost > 0 && (
          <div className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <AlertTriangle size={18} className="text-red-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Total Opportunity Cost</p>
              <p className="text-xs text-red-600 mt-0.5">{periodLabel} — revenue that could have been captured</p>
            </div>
            <p className={`text-2xl font-bold text-red-600 tabular-nums shrink-0 transition-opacity ${loading ? "opacity-30" : ""}`}>
              {format(totalOpportunityCost)}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

          {/* Empty slots */}
          <MoneyLeftCard
            title="Empty Appointment Slots"
            sub="vs. a full 5-day, 4-slot-per-day week"
            icon={CalendarX}
            iconBg="bg-amber-50" iconColor="text-amber-600"
            count={String(totalEmptySlots)}
            countColor="text-amber-600"
            countNote={`unfilled slot${totalEmptySlots !== 1 ? "s" : ""} ${periodLabel.toLowerCase()}`}
            badge={potentialRevenue > 0 && avgTicket > 0
              ? `Up to ${format(potentialMonthlyRevenue)}/mo · ${format(potentialRevenue)} total potential`
              : apptCount === 0 ? "No appointment data yet" : "Fully booked — great work!"}
            badgeCls={potentialRevenue > 0
              ? "text-amber-700 bg-amber-50 border border-amber-200"
              : "text-emerald-700 bg-emerald-50 border border-emerald-200"}
            tip={totalEmptySlots > 0 ? "Share your booking link on Instagram Stories weekly. Offer a flash booking incentive for last-minute slots." : undefined}
            loading={loading}
          />

          {/* Slow leads */}
          <MoneyLeftCard
            title="Slow Lead Response"
            sub="Requests still 'new' after 48 hours"
            icon={Timer}
            iconBg={slowLeads > 0 ? "bg-orange-50" : "bg-[var(--nb-bg)]"}
            iconColor={slowLeads > 0 ? "text-orange-600" : "text-[var(--nb-text-2)]"}
            count={String(slowLeads)}
            countColor={slowLeads > 0 ? "text-orange-600" : "text-[var(--nb-text)]"}
            countNote={slowLeads === 0 ? "All leads answered promptly" : `lead${slowLeads !== 1 ? "s" : ""} waiting on a response`}
            badge={slowLeads > 0 && avgTicket > 0
              ? `~${format(slowLeadLost)} in at-risk revenue (${conversionRate.toFixed(0)}% conv × ${format(Math.round(avgTicket))} avg ticket)`
              : slowLeads > 0 ? "Add avg ticket data to estimate impact" : undefined}
            badgeCls="text-orange-700 bg-orange-50 border border-orange-200"
            tip={slowLeads > 0 ? "Set a goal to reply within 24h. Use Tatflow's intake notifications so you never miss a new request." : undefined}
            loading={loading}
          />

          {/* Ghosted */}
          <MoneyLeftCard
            title="Ghosted Inquiries"
            sub="'New request' status for 7+ days"
            icon={MessageCircleX}
            iconBg={ghostedLeads > 0 ? "bg-red-50" : "bg-[var(--nb-bg)]"}
            iconColor={ghostedLeads > 0 ? "text-red-500" : "text-[var(--nb-text-2)]"}
            count={String(ghostedLeads)}
            countColor={ghostedLeads > 0 ? "text-red-500" : "text-[var(--nb-text)]"}
            countNote={ghostedLeads === 0 ? "No stale inquiries — nice work!" : `inquiry${ghostedLeads !== 1 ? "s" : ""} likely lost`}
            badge={ghostedLeads > 0 && avgTicket > 0
              ? `~${format(ghostedLost)} in missed revenue (50% recovery estimate)`
              : ghostedLeads > 0 ? "Add avg ticket to estimate missed revenue" : undefined}
            badgeCls="text-red-600 bg-red-50 border border-red-200"
            tip={ghostedLeads > 0 ? "Send one follow-up message to stale leads. A simple 'Still interested?' can recover 20–40% of them." : undefined}
            loading={loading}
          />
        </div>
      </section>

      {/* ── 4. Shareable Summary Card ─────────────────────────────────────── */}
      <section>
        <SectionHeading>Shareable Summary</SectionHeading>
        <div className="bg-gradient-to-br from-[#7C3AED]/10 via-[#7C3AED]/5 to-transparent rounded-2xl border border-[#7C3AED]/25 p-6 shadow-sm">

          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[#7C3AED] flex items-center justify-center shrink-0">
                <Zap size={18} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--nb-text)]">Your Tatflow Impact</p>
                <p className="text-xs text-[var(--nb-text-2)]">{periodLabel}</p>
              </div>
            </div>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors bg-[var(--nb-card)] border-[var(--nb-border)] text-[var(--nb-text-2)] hover:text-[var(--nb-text)] hover:bg-[var(--nb-bg)] shrink-0"
            >
              {copied ? <CheckCircle2 size={13} className="text-emerald-600" /> : <Copy size={13} />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <p className={`text-base md:text-lg font-medium text-[var(--nb-text)] leading-relaxed transition-opacity ${loading ? "opacity-30" : ""}`}>
            {summaryText}
          </p>

          <div className="mt-6 pt-5 border-t border-[#7C3AED]/15 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className={`text-2xl font-bold text-[#7C3AED] leading-none transition-opacity ${loading ? "opacity-30" : ""}`}>
                {Math.round(totalAdminHours)}h
              </p>
              <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mt-1.5">Admin Saved</p>
            </div>
            <div>
              <p className={`text-2xl font-bold text-[#7C3AED] leading-none transition-opacity ${loading ? "opacity-30" : ""}`}>
                {format(Math.round(depositsTotal))}
              </p>
              <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mt-1.5">Deposits</p>
            </div>
            <div>
              <p className={`text-2xl font-bold text-[#7C3AED] leading-none transition-opacity ${loading ? "opacity-30" : ""}`}>
                {format(Math.round(totalValueRecovered))}
              </p>
              <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mt-1.5">Est. Recovered</p>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#7C3AED]/15">
            <button
              onClick={() => setShowBreakdown((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7C3AED] hover:text-[#6D28D9] transition-colors"
            >
              {showBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showBreakdown ? "Hide breakdown" : "See breakdown"}
            </button>
          </div>

          {showBreakdown && (
            <div className={`mt-4 space-y-5 transition-opacity ${loading ? "opacity-40" : ""}`}>

              <div>
                <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wider mb-2">
                  Admin Hours Saved
                </p>
                <div className="bg-[var(--nb-card)]/60 rounded-xl border border-[#7C3AED]/15 divide-y divide-[#7C3AED]/10">
                  <div className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--nb-text)]">Booking &amp; reminder admin</p>
                      <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                        45 min saved per appointment × {apptCount} appointment{apptCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-[var(--nb-text)] shrink-0 tabular-nums">
                      {Math.round(totalAdminHours)}h
                    </p>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 gap-4">
                    <p className="text-xs text-[var(--nb-text-2)]">Per week / month / year</p>
                    <p className="text-xs font-medium text-[var(--nb-text)] tabular-nums">
                      {(adminPerMonth / 4.33).toFixed(1)}h · {adminPerMonth.toFixed(1)}h · {(adminPerMonth * 12).toFixed(0)}h
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wider mb-2">
                  Deposits Collected
                </p>
                <div className="bg-[var(--nb-card)]/60 rounded-xl border border-[#7C3AED]/15 divide-y divide-[#7C3AED]/10">
                  <div className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--nb-text)]">Deposit invoices</p>
                      <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                        {depositInvoices.length} deposit invoice{depositInvoices.length !== 1 ? "s" : ""} collected {periodLabel.toLowerCase()}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-[var(--nb-text)] shrink-0 tabular-nums">
                      {format(Math.round(depositsTotal))}
                    </p>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 gap-4">
                    <p className="text-xs text-[var(--nb-text-2)]">Deposit security rate</p>
                    <p className="text-xs font-semibold text-[var(--nb-text)] tabular-nums">
                      {depositSecurityRate.toFixed(0)}% of total revenue secured
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wider mb-2">
                  Estimated Revenue Recovered
                </p>
                <div className="bg-[var(--nb-card)]/60 rounded-xl border border-[#7C3AED]/15 divide-y divide-[#7C3AED]/10">
                  <div className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--nb-text)]">No-show prevention</p>
                      <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                        15% no-show rate × {apptCount} appt{apptCount !== 1 ? "s" : ""} × {format(Math.round(avgTicket))} avg ticket
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-[var(--nb-text)] shrink-0 tabular-nums">
                      {format(revenueFromReminders)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--nb-text)]">Intake conversion value</p>
                      <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                        {intakeDrivenSessions} paid session{intakeDrivenSessions !== 1 ? "s" : ""} from intake-sourced clients
                        {requestCount > 0 ? ` (${conversionRate.toFixed(1)}% conversion)` : ""}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-[var(--nb-text)] shrink-0 tabular-nums">
                      {format(conversionValue)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 gap-4 bg-[#7C3AED]/5 rounded-b-xl">
                    <p className="text-sm font-semibold text-[var(--nb-text)]">Total est. recovered</p>
                    <p className="text-sm font-bold text-[#7C3AED] tabular-nums">
                      {format(Math.round(totalValueRecovered))}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wider mb-2">
                  What This Means
                </p>
                <div className="space-y-2">
                  {totalAdminHours >= 1 && (
                    <p className="text-sm text-[var(--nb-text)] leading-relaxed bg-[var(--nb-card)]/60 rounded-xl border border-[#7C3AED]/15 px-4 py-3">
                      That&apos;s roughly{" "}
                      <span className="font-semibold">{Math.round(totalAdminHours)} hour{Math.round(totalAdminHours) !== 1 ? "s" : ""}</span>{" "}
                      you didn&apos;t spend chasing clients, sending manual reminders, or managing bookings by hand.
                    </p>
                  )}
                  {depositsTotal > 0 && totalRevenue > 0 && (
                    <p className="text-sm text-[var(--nb-text)] leading-relaxed bg-[var(--nb-card)]/60 rounded-xl border border-[#7C3AED]/15 px-4 py-3">
                      Your deposit collection covered{" "}
                      <span className="font-semibold">{depositCoveragePct.toFixed(0)}%</span>{" "}
                      of your total revenue {periodLabel.toLowerCase()} — money secured before you even picked up a needle.
                    </p>
                  )}
                  {revenueFromReminders > 0 && (
                    <p className="text-sm text-[var(--nb-text)] leading-relaxed bg-[var(--nb-card)]/60 rounded-xl border border-[#7C3AED]/15 px-4 py-3">
                      Automated reminders helped protect an estimated{" "}
                      <span className="font-semibold">{format(revenueFromReminders)}</span>{" "}
                      in revenue from no-shows.
                    </p>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </section>

    </div>
  );
}
