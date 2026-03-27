import { CalendarX2 } from "lucide-react";
import type { Appointment } from "../page";

const STATUS_CONFIG: Record<
  string,
  { dot: string; text: string; bg: string }
> = {
  confirmed: {
    dot: "bg-emerald-400",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
  },
  pending: {
    dot: "bg-amber-400",
    text: "text-amber-700",
    bg: "bg-amber-50",
  },
  completed: {
    dot: "bg-sky-400",
    text: "text-sky-700",
    bg: "bg-sky-50",
  },
  cancelled: {
    dot: "bg-red-400",
    text: "text-red-700",
    bg: "bg-red-50",
  },
};

function getStatusConfig(status: string) {
  return (
    STATUS_CONFIG[status.toLowerCase()] ?? {
      dot: "bg-[var(--nb-border)]",
      text: "text-[var(--nb-text-2)]",
      bg: "bg-[var(--nb-active-bg)]",
    }
  );
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function UpcomingAppointments({
  appointments,
}: {
  appointments: Appointment[];
}) {
  return (
    <section>
      <div className="flex items-center gap-2.5 mb-4">
        <h2 className="text-base font-semibold text-[var(--nb-text)]">
          Upcoming Appointments
        </h2>
        <span className="text-xs font-medium text-[var(--nb-text-2)] bg-[var(--nb-border)] rounded-full px-2.5 py-0.5">
          {appointments.length}
        </span>
      </div>
      <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] overflow-hidden shadow-sm">
        {appointments.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-center">
            <CalendarX2 size={32} className="text-[var(--nb-border)] mb-3" />
            <p className="text-sm font-medium text-[var(--nb-text-2)]">No upcoming appointments</p>
            <p className="text-xs text-[var(--nb-text-2)] mt-1">Booked appointments will appear here</p>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-[var(--nb-border)]">
              {appointments.map((appt) => {
                const cfg = getStatusConfig(appt.status);
                return (
                  <div key={appt.id} className="px-4 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--nb-text)] truncate">
                        {appt.clients?.name ?? "—"}
                      </p>
                      <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                        {formatDate(appt.date)} · {formatTime(appt.time)}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.text} ${cfg.bg}`}>
                      <span className={`size-1.5 rounded-full ${cfg.dot}`} />
                      {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--nb-border)] bg-[var(--nb-card)]">
                    <th className="text-left px-5 py-3 font-medium text-[var(--nb-text-2)] text-xs uppercase tracking-wide">Client</th>
                    <th className="text-left px-5 py-3 font-medium text-[var(--nb-text-2)] text-xs uppercase tracking-wide">Type</th>
                    <th className="text-left px-5 py-3 font-medium text-[var(--nb-text-2)] text-xs uppercase tracking-wide">Date</th>
                    <th className="text-left px-5 py-3 font-medium text-[var(--nb-text-2)] text-xs uppercase tracking-wide">Time</th>
                    <th className="text-left px-5 py-3 font-medium text-[var(--nb-text-2)] text-xs uppercase tracking-wide">Artist</th>
                    <th className="text-left px-5 py-3 font-medium text-[var(--nb-text-2)] text-xs uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--nb-card)]">
                  {appointments.map((appt) => {
                    const cfg = getStatusConfig(appt.status);
                    return (
                      <tr key={appt.id} className="hover:bg-[var(--nb-card)] transition-colors">
                        <td className="px-5 py-3.5 font-medium text-[var(--nb-text)]">{appt.clients?.name ?? "—"}</td>
                        <td className="px-5 py-3.5 text-[var(--nb-text-2)]">{appt.type}</td>
                        <td className="px-5 py-3.5 text-[var(--nb-text-2)]">{formatDate(appt.date)}</td>
                        <td className="px-5 py-3.5 text-[var(--nb-text-2)]">{formatTime(appt.time)}</td>
                        <td className="px-5 py-3.5 text-[var(--nb-text-2)]">{appt.artist_name}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.text} ${cfg.bg}`}>
                            <span className={`size-1.5 rounded-full ${cfg.dot}`} />
                            {appt.status.charAt(0).toUpperCase() + appt.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
