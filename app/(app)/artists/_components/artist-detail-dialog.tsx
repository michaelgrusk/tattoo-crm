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
import { Link, Mail, Phone, Pencil } from "lucide-react";
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

// ── Component ─────────────────────────────────────────────────────────────────

type Stats = {
  totalSessions: number;
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
  const [stats, setStats] = useState<Stats>({
    totalSessions: 0,
    upcomingSessions: 0,
  });

  useEffect(() => {
    if (!open) return;

    async function fetchStats() {
      const today = new Date().toISOString().split("T")[0];

      const [totalRes, upcomingRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("artist_id", artist.id),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("artist_id", artist.id)
          .gte("date", today),
      ]);

      setStats({
        totalSessions: totalRes.count ?? 0,
        upcomingSessions: upcomingRes.count ?? 0,
      });
    }

    fetchStats();
  }, [open, artist.id]);

  const color = getAvatarColor(artist.name);
  const initials = getInitials(artist.name);

  return (
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
            <div className="rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-3 text-center">
              <p className="text-xs text-[var(--nb-text-2)] mb-1">
                Total sessions
              </p>
              <p className="text-2xl font-bold text-[var(--nb-text)]">
                {stats.totalSessions}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--nb-border)] bg-[var(--nb-bg)] px-4 py-3 text-center">
              <p className="text-xs text-[var(--nb-text-2)] mb-1">Upcoming</p>
              <p className="text-2xl font-bold text-[#7C3AED]">
                {stats.upcomingSessions}
              </p>
            </div>
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
  );
}
