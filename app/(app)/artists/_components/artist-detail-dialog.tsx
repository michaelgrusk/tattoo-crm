"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Link, Mail, Phone, Pencil, X, Loader2, CalendarDays, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { Artist } from "../page";

// ── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: "bg-sky-100", text: "text-sky-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-teal-100", text: "text-teal-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (
    words[0].charAt(0).toUpperCase() +
    words[words.length - 1].charAt(0).toUpperCase()
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type CompletedAppt = {
  id: string;
  date: string;
  type: string;
  clients: { name: string } | null;
  invoices: { amount: number }[];
};

type UpcomingAppt = {
  id: string;
  date: string;
  time: string;
  type: string;
  status: string;
  clients: { name: string } | null;
};

const STATUS_STYLES: Record<string, { text: string; bg: string }> = {
  scheduled:   { text: "text-sky-700",     bg: "bg-sky-50" },
  confirmed:   { text: "text-emerald-700", bg: "bg-emerald-50" },
  "in progress": { text: "text-violet-700", bg: "bg-violet-50" },
  completed:   { text: "text-emerald-700", bg: "bg-emerald-50" },
  cancelled:   { text: "text-red-700",     bg: "bg-red-50" },
};

function statusStyle(s: string) {
  return STATUS_STYLES[s.toLowerCase()] ?? { text: "text-[var(--nb-text-2)]", bg: "bg-[var(--nb-border)]" };
}

// ── Completed Sessions Dialog ─────────────────────────────────────────────────

function CompletedSessionsDialog({
  open,
  onOpenChange,
  artistId,
  artistName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  artistId: number;
  artistName: string;
}) {
  const [appts, setAppts] = useState<CompletedAppt[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("appointments")
      .select("id, date, type, clients(name), invoices(amount)")
      .eq("artist_id", artistId)
      .eq("status", "completed")
      .order("date", { ascending: false })
      .then(({ data }) => {
        setAppts((data as unknown as CompletedAppt[]) ?? []);
        setLoading(false);
      });
  }, [open, artistId]);

  const totalEarned = appts.reduce(
    (sum, a) => sum + (a.invoices?.[0]?.amount ?? 0),
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-[var(--nb-card)] border border-[var(--nb-border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--nb-text)]">
            Sessions Completed — {artistName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-[var(--nb-text-2)]" />
          </div>
        ) : appts.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--nb-text-2)]">
            No completed sessions yet.
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {totalEarned > 0 && (
              <div className="rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-2.5 flex items-center justify-between mb-3">
                <span className="text-xs text-[var(--nb-text-2)]">Total invoiced</span>
                <span className="text-sm font-semibold text-emerald-700">
                  ${totalEarned.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {appts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--nb-text)] truncate">
                    {a.clients?.name ?? "Unknown client"}
                  </p>
                  <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                    {formatDate(a.date)} · {a.type}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {a.invoices?.[0]?.amount != null && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                      ${a.invoices[0].amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="border-[var(--nb-border)] text-[var(--nb-text-2)]">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Upcoming Sessions Dialog ──────────────────────────────────────────────────

function UpcomingSessionsDialog({
  open,
  onOpenChange,
  artistId,
  artistName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  artistId: number;
  artistName: string;
}) {
  const [appts, setAppts] = useState<UpcomingAppt[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("appointments")
      .select("id, date, time, type, status, clients(name)")
      .eq("artist_id", artistId)
      .gte("date", today)
      .neq("status", "completed")
      .neq("status", "cancelled")
      .order("date", { ascending: true })
      .order("time", { ascending: true })
      .then(({ data }) => {
        setAppts((data as unknown as UpcomingAppt[]) ?? []);
        setLoading(false);
      });
  }, [open, artistId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-[var(--nb-card)] border border-[var(--nb-border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--nb-text)]">
            Upcoming Appointments — {artistName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-[var(--nb-text-2)]" />
          </div>
        ) : appts.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--nb-text-2)]">
            No upcoming appointments.
          </div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {appts.map((a) => {
              const ss = statusStyle(a.status);
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--nb-text)] truncate">
                      {a.clients?.name ?? "Unknown client"}
                    </p>
                    <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
                      {formatDate(a.date)} · {formatTime(a.time)} · {a.type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ss.text} ${ss.bg}`}>
                      {a.status}
                    </span>
                    <a
                      href="/calendar"
                      className="shrink-0 size-7 flex items-center justify-center rounded-lg hover:bg-[var(--nb-active-bg)] text-[var(--nb-text-2)] hover:text-[#7C3AED] transition-colors"
                      title="View in Calendar"
                    >
                      <CalendarDays size={13} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="border-[var(--nb-border)] text-[var(--nb-text-2)]">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────

type Stats = {
  completedSessions: number;
  upcomingSessions: number;
};

export function ArtistDetailDialog({
  open,
  onOpenChange,
  artist,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  artist: Artist;
  onEdit: () => void;
}) {
  const [stats, setStats] = useState<Stats>({ completedSessions: 0, upcomingSessions: 0 });
  const [completedOpen, setCompletedOpen] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    async function fetchStats() {
      const today = new Date().toISOString().split("T")[0];

      const [completedRes, upcomingRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("artist_id", artist.id)
          .eq("status", "completed"),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("artist_id", artist.id)
          .gte("date", today)
          .neq("status", "completed")
          .neq("status", "cancelled"),
      ]);

      setStats({
        completedSessions: completedRes.count ?? 0,
        upcomingSessions: upcomingRes.count ?? 0,
      });
    }

    fetchStats();
  }, [open, artist.id]);

  const color = getAvatarColor(artist.name);
  const initials = getInitials(artist.name);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[var(--nb-card)] border border-[var(--nb-border)]">
        <DialogHeader>
          <DialogTitle className="sr-only">Artist details</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            {artist.avatar_url ? (
              <img
                src={artist.avatar_url}
                alt={artist.name}
                className="size-16 rounded-2xl object-cover border border-[var(--nb-border)] shrink-0"
              />
            ) : (
              <div
                className={`size-16 rounded-2xl shrink-0 flex items-center justify-center text-xl font-bold ${color.bg} ${color.text}`}
              >
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-[var(--nb-text)] leading-tight">
                  {artist.name}
                </h2>
                {!artist.is_active && (
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--nb-bg)] text-[var(--nb-text-2)] border border-[var(--nb-border)]">
                    Inactive
                  </span>
                )}
              </div>
              {artist.years_experience != null && (
                <p className="text-sm text-[var(--nb-text-2)] mt-0.5">
                  {artist.years_experience}{" "}
                  {artist.years_experience === 1 ? "year" : "years"} experience
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCompletedOpen(true)}
              className="rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-3 text-center hover:border-[#7C3AED]/40 hover:bg-[var(--nb-active-bg)] transition-colors group"
            >
              <p className="text-xs text-[var(--nb-text-2)] mb-1 group-hover:text-[#7C3AED] transition-colors">
                Sessions completed
              </p>
              <p className="text-2xl font-bold text-[var(--nb-text)]">
                {stats.completedSessions}
              </p>
            </button>
            <button
              onClick={() => setUpcomingOpen(true)}
              className="rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-3 text-center hover:border-[#7C3AED]/40 hover:bg-[var(--nb-active-bg)] transition-colors group"
            >
              <p className="text-xs text-[var(--nb-text-2)] mb-1 group-hover:text-[#7C3AED] transition-colors">
                Upcoming
              </p>
              <p className="text-2xl font-bold text-[#7C3AED]">
                {stats.upcomingSessions}
              </p>
            </button>
          </div>

          {/* Bio */}
          {artist.bio && (
            <div>
              <p className="text-xs font-medium text-[var(--nb-text-2)] mb-1.5 uppercase tracking-wide">
                Bio
              </p>
              <p className="text-sm text-[var(--nb-text)] leading-relaxed">
                {artist.bio}
              </p>
            </div>
          )}

          {/* Styles */}
          {artist.styles && artist.styles.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--nb-text-2)] mb-1.5 uppercase tracking-wide">
                Styles
              </p>
              <div className="flex flex-wrap gap-1.5">
                {artist.styles.map((style) => (
                  <span
                    key={style}
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--nb-active-bg)] text-[#7C3AED]"
                  >
                    {style}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Contact */}
          {(artist.instagram || artist.email || artist.phone) && (
            <div>
              <p className="text-xs font-medium text-[var(--nb-text-2)] mb-1.5 uppercase tracking-wide">
                Contact
              </p>
              <div className="space-y-1.5">
                {artist.instagram && (
                  <a
                    href={`https://instagram.com/${artist.instagram.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[var(--nb-text)] hover:text-[#7C3AED] transition-colors"
                  >
                    <Link size={14} className="text-[var(--nb-text-2)]" />
                    {artist.instagram.startsWith("@")
                      ? artist.instagram
                      : `@${artist.instagram}`}
                  </a>
                )}
                {artist.email && (
                  <a
                    href={`mailto:${artist.email}`}
                    className="flex items-center gap-2 text-sm text-[var(--nb-text)] hover:text-[#7C3AED] transition-colors"
                  >
                    <Mail size={14} className="text-[var(--nb-text-2)]" />
                    {artist.email}
                  </a>
                )}
                {artist.phone && (
                  <a
                    href={`tel:${artist.phone}`}
                    className="flex items-center gap-2 text-sm text-[var(--nb-text)] hover:text-[#7C3AED] transition-colors"
                  >
                    <Phone size={14} className="text-[var(--nb-text-2)]" />
                    {artist.phone}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between gap-2 pt-2">
          <Button
            variant="outline"
            onClick={onEdit}
            className="gap-1.5 border-[var(--nb-border)] text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
          >
            <Pencil size={14} />
            Edit Artist
          </Button>
          <DialogClose asChild>
            <Button
              variant="outline"
              className="border-[var(--nb-border)] text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
            >
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <CompletedSessionsDialog
      open={completedOpen}
      onOpenChange={setCompletedOpen}
      artistId={artist.id}
      artistName={artist.name}
    />

    <UpcomingSessionsDialog
      open={upcomingOpen}
      onOpenChange={setUpcomingOpen}
      artistId={artist.id}
      artistName={artist.name}
    />
    </>
  );
}
