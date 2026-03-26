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
      dot: "bg-gray-300",
      text: "text-gray-600",
      bg: "bg-gray-50",
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
        <h2 className="text-base font-semibold text-gray-800">
          Upcoming Appointments
        </h2>
        <span className="text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2.5 py-0.5">
          {appointments.length}
        </span>
      </div>
      <div className="bg-white rounded-xl border border-[#D6EAF0] overflow-hidden shadow-sm">
        {appointments.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-center">
            <CalendarX2 size={32} className="text-[#D6EAF0] mb-3" />
            <p className="text-sm font-medium text-gray-500">No upcoming appointments</p>
            <p className="text-xs text-gray-400 mt-1">Booked appointments will appear here</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#D6EAF0] bg-[#F8FCFE]">
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                  Client
                </th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                  Type
                </th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                  Date
                </th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                  Time
                </th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                  Artist
                </th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF5F8]">
              {appointments.map((appt) => {
                const cfg = getStatusConfig(appt.status);
                return (
                  <tr
                    key={appt.id}
                    className="hover:bg-[#F8FCFE] transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium text-gray-900">
                      {appt.clients?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{appt.type}</td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {formatDate(appt.date)}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {formatTime(appt.time)}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      {appt.artist_name}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.text} ${cfg.bg}`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${cfg.dot}`}
                        />
                        {appt.status.charAt(0).toUpperCase() +
                          appt.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
