import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ─── iCal helpers ─────────────────────────────────────────────────────────────

/** Fold long lines per RFC 5545 §3.1 (max 75 octets, continuation = CRLF + space). */
function fold(line: string): string {
  const MAX = 75;
  if (line.length <= MAX) return line;
  let out = "";
  while (line.length > MAX) {
    out += line.slice(0, MAX) + "\r\n ";
    line = line.slice(MAX);
  }
  return out + line;
}

/** Escape special iCal characters in text values. */
function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Current UTC timestamp in iCal format: YYYYMMDDTHHmmssZ */
function dtstamp(): string {
  return new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
}

/**
 * Convert a date string ("YYYY-MM-DD") and time string ("HH:MM" or "HH:MM:SS")
 * to an iCal floating local datetime: YYYYMMDDTHHmmss
 * (No timezone suffix = floating time, renders in the viewer's local zone.)
 */
function toICalLocal(date: string, time: string): string {
  const [y, mo, d] = date.split("-");
  const [h, mi] = time.split(":");
  return `${y}${mo}${d}T${h.padStart(2, "0")}${mi.padStart(2, "0")}00`;
}

/**
 * Add `hours` to a local datetime string and return a new local datetime string.
 */
function addHours(date: string, time: string, hours: number): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const dt = new Date(y, mo - 1, d, h + hours, mi);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}` +
    `T${pad(dt.getHours())}${pad(dt.getMinutes())}00`
  );
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const supabase = await createSupabaseServerClient();

  // 1. Look up the studio by slug
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, studio_name")
    .eq("slug", slug)
    .single();

  if (profileError || !profile) {
    return new NextResponse("Studio not found", { status: 404 });
  }

  const today = new Date().toISOString().slice(0, 10);

  // 2. Fetch upcoming appointments with client name
  const { data: appointments, error: apptError } = await supabase
    .from("appointments")
    .select("id, date, time, type, status, clients(name)")
    .eq("user_id", profile.id)
    .gte("date", today)
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (apptError) {
    return new NextResponse("Failed to fetch appointments", { status: 500 });
  }

  // 3. Build iCal
  const calName = escapeText(profile.studio_name ?? "Needlebook Appointments");
  const stamp = dtstamp();

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Needlebook//Tattoo CRM//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${calName}`),
    "X-WR-CALDESC:Appointments synced from Needlebook",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const appt of appointments ?? []) {
    const clientRow = appt.clients as unknown as { name: string } | null;
    const clientName = clientRow?.name ?? null;
    const type = appt.type ?? "Appointment";
    const summary = clientName ? `${clientName} — ${type}` : type;
    const description = [
      `Type: ${type}`,
      `Status: ${appt.status ?? "scheduled"}`,
      clientName ? `Client: ${clientName}` : "",
    ]
      .filter(Boolean)
      .join("\\n");

    const dtstart = toICalLocal(appt.date, appt.time ?? "09:00");
    const dtend   = addHours(appt.date, appt.time ?? "09:00", 2);

    lines.push(
      "BEGIN:VEVENT",
      fold(`UID:needlebook-appt-${appt.id}@needlebook.app`),
      fold(`DTSTAMP:${stamp}`),
      fold(`DTSTART:${dtstart}`),
      fold(`DTEND:${dtend}`),
      fold(`SUMMARY:${escapeText(summary)}`),
      fold(`DESCRIPTION:${description}`),
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  const ics = lines.join("\r\n") + "\r\n";

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-appointments.ics"`,
      // Allow calendar apps to cache for up to 1 hour
      "Cache-Control": "public, max-age=3600",
    },
  });
}
