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
} from "lucide-react";
import { supabase, getUserId } from "@/lib/supabase/client";
import { useCurrency } from "@/components/currency-provider";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "month" | "3m" | "6m" | "year";

type PaidInvoice  = { amount: number; client_id: string };
type DepositInvoice = { amount: number };
type Appointment  = { id: string; date: string };
type Request      = { id: string; status: string; created_at: string };

// ─── Period helpers ───────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { value: Period; label: string; months: number }[] = [
  { value: "month", label: "This month",     months: 1  },
  { value: "3m",    label: "Past 3 months",  months: 3  },
  { value: "6m",    label: "Past 6 months",  months: 6  },
  { value: "year",  label: "This year",      months: 12 },
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
  count, countColor, countNote, badge, badgeCls, loading,
}: {
  title: string; sub: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
  count: string; countColor: string; countNote: string;
  badge?: string; badgeCls?: string; loading: boolean;
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
  const [paidInvoices,   setPaidInvoices]   = useState<PaidInvoice[]>([]);
  const [depositInvoices, setDepositInvoices] = useState<DepositInvoice[]>([]);
  const [appointments,   setAppointments]   = useState<Appointment[]>([]);
  const [tattooRequests, setTattooRequests] = useState<Request[]>([]);
  const [allClientCount, setAllClientCount] = useState(0);
  const [allPaidInvoices, setAllPaidInvoices] = useState<{ client_id: string }[]>([]);
  const [intakeClientIds, setIntakeClientIds] = useState<Set<string>>(new Set());

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
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("invoices").select("amount, client_id")
          .eq("user_id", userId).eq("status", "paid")
          .gte("date", start).lte("date", end),
        supabase.from("invoices").select("amount")
          .eq("user_id", userId).eq("status", "deposit")
          .gte("date", start).lte("date", end),
        supabase.from("appointments").select("id, date")
          .eq("user_id", userId).gte("date", start).lte("date", end),
        supabase.from("tattoo_requests").select("id, status, created_at")
          .eq("user_id", userId)
          .gte("created_at", start).lte("created_at", end + "T23:59:59"),
        supabase.from("clients").select("id").eq("user_id", userId),
        // All-time paid invoice client_ids for repeat rate
        supabase.from("invoices").select("client_id")
          .eq("user_id", userId).eq("status", "paid"),
        // All-time intake client_ids for conversion value
        supabase.from("tattoo_requests").select("client_id")
          .eq("user_id", userId).not("client_id", "is", null),
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
  const conversionRate = requestCount > 0 ? (apptCount / requestCount) * 100 : 0;
  const avgTicket      = paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0;

  // Repeat client rate (all-time)
  const paidPerClient: Record<string, number> = {};
  for (const inv of allPaidInvoices) {
    paidPerClient[inv.client_id] = (paidPerClient[inv.client_id] ?? 0) + 1;
  }
  const repeatCount = Object.values(paidPerClient).filter((n) => n > 1).length;
  const repeatRate  = allClientCount > 0 ? (repeatCount / allClientCount) * 100 : 0;

  // Admin hours: 45 min per appointment
  const totalAdminHours    = apptCount * 0.75;
  const adminPerMonth      = periodMonths > 0 ? totalAdminHours / periodMonths : totalAdminHours;

  // Revenue from reminders: 15% no-show protection
  const revenueFromReminders = Math.round(apptCount * 0.15 * avgTicket);

  // Conversion value: paid revenue in period from clients who came through intake
  const conversionValue = Math.round(
    paidInvoices.filter((inv) => intakeClientIds.has(inv.client_id))
      .reduce((s, i) => s + i.amount, 0)
  );

  // Empty slots
  const weeksInPeriod  = (periodMonths * 365) / 12 / 7;
  const slotsPerWeek   = weeksInPeriod > 0 ? apptCount / weeksInPeriod : 0;
  const emptyPerWeek   = Math.max(0, 20 - slotsPerWeek); // 20 = 5 days × 4 slots
  const totalEmptySlots = Math.round(emptyPerWeek * weeksInPeriod);
  const potentialRevenue = Math.round(totalEmptySlots * avgTicket);

  // Slow leads & ghosted (within period)
  const now = Date.now();
  const ms48h = 48 * 60 * 60 * 1000;
  const ms7d  = 7  * 24 * 60 * 60 * 1000;
  const slowLeads    = tattooRequests.filter(
    (r) => r.status === "new request" && now - new Date(r.created_at).getTime() > ms48h
  ).length;
  const ghostedLeads = tattooRequests.filter(
    (r) => r.status === "new request" && now - new Date(r.created_at).getTime() > ms7d
  ).length;

  // Totals for summary card
  const totalValueRecovered = revenueFromReminders + depositsTotal + conversionValue;
  // Count paid sessions that came from intake-sourced clients
  const intakeDrivenSessions = paidInvoices.filter((inv) => intakeClientIds.has(inv.client_id)).length;
  // Deposit coverage as % of total revenue
  const depositCoveragePct = totalRevenue > 0 ? (depositsTotal / totalRevenue) * 100 : 0;
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

      {/* ── 1. Your Studio Stats ─────────────────────────────────────────── */}
      <section>
        <SectionHeading sub={`Pulled from your Tatflow data — ${periodLabel.toLowerCase()}`}>
          Your Studio Stats
        </SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <StudioStatCard
            label="Total Revenue"   value={format(Math.round(totalRevenue))}
            sub="paid invoices"     icon={TrendingUp}
            iconBg="bg-emerald-50"  iconColor="text-emerald-600" loading={loading}
          />
          <StudioStatCard
            label="Deposits Collected" value={format(Math.round(depositsTotal))}
            sub="secured upfront"      icon={DollarSign}
            iconBg="bg-sky-50"         iconColor="text-sky-600" loading={loading}
          />
          <StudioStatCard
            label="Appointments"    value={String(apptCount)}
            sub={periodLabel.toLowerCase()}  icon={CalendarDays}
            iconBg="bg-violet-50"   iconColor="text-violet-600" loading={loading}
          />
          <StudioStatCard
            label="Intake Requests" value={String(requestCount)}
            sub="via intake form"   icon={FileText}
            iconBg="bg-amber-50"    iconColor="text-amber-600" loading={loading}
          />
          <StudioStatCard
            label="Conversion Rate"     value={`${conversionRate.toFixed(1)}%`}
            sub="requests → bookings"   icon={Repeat2}
            iconBg="bg-[var(--nb-active-bg)]" iconColor="text-[#7C3AED]" loading={loading}
          />
          <StudioStatCard
            label="Avg Ticket Value"  value={format(Math.round(avgTicket))}
            sub="per paid session"    icon={Star}
            iconBg="bg-rose-50"       iconColor="text-rose-600" loading={loading}
          />
          <StudioStatCard
            label="Repeat Client Rate"       value={`${repeatRate.toFixed(1)}%`}
            sub="returning clients (all time)" icon={UserCheck}
            iconBg="bg-teal-50"              iconColor="text-teal-600" loading={loading}
          />
        </div>
      </section>

      {/* ── 2. Estimated Value Recovered ─────────────────────────────────── */}
      <section>
        <SectionHeading sub="Conservative estimates based on industry benchmarks">
          Estimated Value Recovered
        </SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ValueCard
            label="Admin Hours Saved"
            mainValue={`${Math.round(totalAdminHours)}h`}
            sub={`45 min saved per appointment × ${apptCount} appointment${apptCount !== 1 ? "s" : ""}`}
            accent={`${adminPerMonth.toFixed(1)}h/mo · ${(adminPerMonth * 3).toFixed(0)}h/qtr · ${(adminPerMonth * 12).toFixed(0)}h/yr`}
            loading={loading}
          />
          <ValueCard
            label="Revenue from Reminders"
            mainValue={format(revenueFromReminders)}
            sub={`15% no-show protection × ${apptCount} appointment${apptCount !== 1 ? "s" : ""}`}
            accent={avgTicket > 0 ? `@ ${format(Math.round(avgTicket))} avg ticket` : undefined}
            loading={loading}
          />
          <ValueCard
            label="Deposits Secured"
            mainValue={format(Math.round(depositsTotal))}
            sub="Already collected through Tatflow"
            accent="Revenue in hand before the session"
            loading={loading}
          />
          <ValueCard
            label="Intake Conversion Value"
            mainValue={format(conversionValue)}
            sub="Revenue from clients who came through your intake form"
            accent={conversionRate > 0 ? `${conversionRate.toFixed(1)}% conversion rate` : undefined}
            loading={loading}
          />
        </div>
      </section>

      {/* ── 3. Money Left on the Table ───────────────────────────────────── */}
      <section>
        <SectionHeading sub="Opportunities to capture more revenue">
          Money Left on the Table
        </SectionHeading>
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
              ? `Up to ${format(potentialRevenue)} in potential revenue`
              : apptCount === 0 ? "No appointment data yet" : "Fully booked — great work!"}
            badgeCls={potentialRevenue > 0
              ? "text-amber-700 bg-amber-50 border border-amber-200"
              : "text-emerald-700 bg-emerald-50 border border-emerald-200"}
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
            badge={slowLeads > 0 ? "Fast response = higher conversion rate" : undefined}
            badgeCls="text-orange-700 bg-orange-50 border border-orange-200"
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
              ? `~${format(Math.round(ghostedLeads * avgTicket * 0.5))} in missed revenue`
              : ghostedLeads > 0 ? "Add avg ticket to estimate missed revenue" : undefined}
            badgeCls="text-red-600 bg-red-50 border border-red-200"
            loading={loading}
          />
        </div>
      </section>

      {/* ── 4. Shareable Summary Card ─────────────────────────────────────── */}
      <section>
        <SectionHeading>Shareable Summary</SectionHeading>
        <div className="bg-gradient-to-br from-[#7C3AED]/10 via-[#7C3AED]/5 to-transparent rounded-2xl border border-[#7C3AED]/25 p-6 shadow-sm">

          {/* Header */}
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

          {/* Summary sentence */}
          <p className={`text-base md:text-lg font-medium text-[var(--nb-text)] leading-relaxed transition-opacity ${loading ? "opacity-30" : ""}`}>
            {summaryText}
          </p>

          {/* 3 headline numbers */}
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

          {/* See breakdown toggle */}
          <div className="mt-5 pt-4 border-t border-[#7C3AED]/15">
            <button
              onClick={() => setShowBreakdown((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7C3AED] hover:text-[#6D28D9] transition-colors"
            >
              {showBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showBreakdown ? "Hide breakdown" : "See breakdown"}
            </button>
          </div>

          {/* Collapsible breakdown */}
          {showBreakdown && (
            <div className={`mt-4 space-y-5 transition-opacity ${loading ? "opacity-40" : ""}`}>

              {/* ── Admin hours ── */}
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
                </div>
              </div>

              {/* ── Deposits ── */}
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
                </div>
              </div>

              {/* ── Estimated revenue recovered ── */}
              <div>
                <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wider mb-2">
                  Estimated Revenue Recovered
                </p>
                <div className="bg-[var(--nb-card)]/60 rounded-xl border border-[#7C3AED]/15 divide-y divide-[#7C3AED]/10">
                  <div className="flex items-center justify-between px-4 py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--nb-text)]">No-show prevention</p>
                      <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                        15% no-show rate × {apptCount} appointment{apptCount !== 1 ? "s" : ""} × {format(Math.round(avgTicket))} avg ticket
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

              {/* ── What this means ── */}
              <div>
                <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wider mb-2">
                  What This Means
                </p>
                <div className="space-y-2">
                  {totalAdminHours >= 1 && (
                    <p className="text-sm text-[var(--nb-text)] leading-relaxed bg-[var(--nb-card)]/60 rounded-xl border border-[#7C3AED]/15 px-4 py-3">
                      💆 That&apos;s roughly{" "}
                      <span className="font-semibold">{Math.round(totalAdminHours)} hour{Math.round(totalAdminHours) !== 1 ? "s" : ""}</span>{" "}
                      you didn&apos;t spend chasing clients, sending manual reminders, or managing bookings by hand.
                    </p>
                  )}
                  {depositsTotal > 0 && totalRevenue > 0 && (
                    <p className="text-sm text-[var(--nb-text)] leading-relaxed bg-[var(--nb-card)]/60 rounded-xl border border-[#7C3AED]/15 px-4 py-3">
                      🏦 Your deposit collection covered{" "}
                      <span className="font-semibold">{depositCoveragePct.toFixed(0)}%</span>{" "}
                      of your total revenue {periodLabel.toLowerCase()} — money secured before you even picked up a needle.
                    </p>
                  )}
                  {revenueFromReminders > 0 && (
                    <p className="text-sm text-[var(--nb-text)] leading-relaxed bg-[var(--nb-card)]/60 rounded-xl border border-[#7C3AED]/15 px-4 py-3">
                      📅 Automated appointment reminders helped protect an estimated{" "}
                      <span className="font-semibold">{format(revenueFromReminders)}</span>{" "}
                      in revenue from no-shows — sessions that would otherwise have gone unbilled.
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
