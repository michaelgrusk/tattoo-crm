"use client";

import { useState, useEffect } from "react";
import { Plus, Users2, Pencil, PowerOff, CheckCircle2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Artist } from "../page";
import { AddEditArtistDialog } from "./add-edit-artist-dialog";
import { ArtistDetailDialog } from "./artist-detail-dialog";

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

// ── Artist card ───────────────────────────────────────────────────────────────

function ArtistCard({
  artist,
  upcomingCount,
  onOpen,
  onEdit,
  onToggle,
}: {
  artist: Artist;
  upcomingCount: number;
  onOpen: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onToggle: (e: React.MouseEvent) => void;
}) {
  const color = getAvatarColor(artist.name);
  const initials = getInitials(artist.name);
  const visibleStyles = artist.styles?.slice(0, 4) ?? [];
  const extraCount = (artist.styles?.length ?? 0) - visibleStyles.length;

  return (
    <div
      onClick={onOpen}
      className="relative cursor-pointer rounded-2xl border border-[var(--nb-border)] bg-[var(--nb-card)] p-4 hover:shadow-md hover:border-[#7C3AED]/30 transition-all group"
    >
      {/* Inactive badge */}
      {!artist.is_active && (
        <span className="absolute top-3 right-3 rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--nb-bg)] text-[var(--nb-text-2)] border border-[var(--nb-border)]">
          Inactive
        </span>
      )}

      <div className="flex items-start gap-3">
        {/* Avatar */}
        {artist.avatar_url ? (
          <img
            src={artist.avatar_url}
            alt={artist.name}
            className="size-14 rounded-2xl object-cover border border-[var(--nb-border)] shrink-0"
          />
        ) : (
          <div
            className={`size-14 rounded-2xl shrink-0 flex items-center justify-center text-lg font-bold ${color.bg} ${color.text}`}
          >
            {initials}
          </div>
        )}

        {/* Info */}
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-[var(--nb-text)] group-hover:text-[#7C3AED] transition-colors leading-tight truncate">
            {artist.name}
          </p>
          {artist.years_experience != null && (
            <p className="text-xs text-[var(--nb-text-2)] mt-0.5">
              {artist.years_experience}{" "}
              {artist.years_experience === 1 ? "yr" : "yrs"} experience
            </p>
          )}

          {upcomingCount > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <CalendarDays size={11} className="text-[#7C3AED]" />
              <span className="text-[11px] font-medium text-[#7C3AED]">
                {upcomingCount} upcoming
              </span>
            </div>
          )}

          {/* Style tags */}
          {visibleStyles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {visibleStyles.map((style) => (
                <span
                  key={style}
                  className="rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--nb-active-bg)] text-[#7C3AED]"
                >
                  {style}
                </span>
              ))}
              {extraCount > 0 && (
                <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--nb-active-bg)] text-[#7C3AED]">
                  +{extraCount} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="flex gap-2 border-t border-[var(--nb-border)] mt-4 pt-4">
        <button
          onClick={onEdit}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--nb-border)] bg-transparent px-2 py-1.5 text-xs font-medium text-[var(--nb-text-2)] hover:text-[var(--nb-text)] hover:border-[#7C3AED]/40 transition-colors"
        >
          <Pencil size={12} />
          Edit
        </button>
        {artist.is_active ? (
          <button
            onClick={onToggle}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--nb-border)] bg-transparent px-2 py-1.5 text-xs font-medium text-[var(--nb-text-2)] hover:text-red-500 hover:border-red-400/40 transition-colors"
          >
            <PowerOff size={12} />
            Deactivate
          </button>
        ) : (
          <button
            onClick={onToggle}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300/40 bg-transparent px-2 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50/20 transition-colors"
          >
            <CheckCircle2 size={12} />
            Reactivate
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function ArtistsView({ artists: initial }: { artists: Artist[] }) {
  const router = useRouter();
  const [artists, setArtists] = useState<Artist[]>(initial);
  const [addEditOpen, setAddEditOpen] = useState(false);
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
  const [detailArtist, setDetailArtist] = useState<Artist | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [upcomingByArtist, setUpcomingByArtist] = useState<Record<number, number>>({});

  useEffect(() => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    supabase
      .from("appointments")
      .select("artist_id")
      .gte("date", fmt(today))
      .neq("status", "completed")
      .neq("status", "cancelled")
      .not("artist_id", "is", null)
      .then(({ data }) => {
        if (!data) return;
        const counts: Record<number, number> = {};
        for (const row of data) {
          if (row.artist_id) counts[row.artist_id] = (counts[row.artist_id] ?? 0) + 1;
        }
        setUpcomingByArtist(counts);
      });
  }, []);

  function fireToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function openAdd() {
    setEditingArtist(null);
    setAddEditOpen(true);
  }

  function openEdit(a: Artist, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingArtist(a);
    setAddEditOpen(true);
  }

  function handleSaved(saved: Artist) {
    setArtists((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    const isEdit = artists.some((a) => a.id === saved.id);
    fireToast(isEdit ? "Artist updated" : "Artist added");
    router.refresh();
  }

  async function handleToggleActive(a: Artist, e: React.MouseEvent) {
    e.stopPropagation();
    const { data, error } = await supabase
      .from("artists")
      .update({ is_active: !a.is_active })
      .eq("id", a.id)
      .select("*")
      .single();
    if (error || !data) return;
    const updated = data as Artist;
    setArtists((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    fireToast(updated.is_active ? "Artist reactivated" : "Artist deactivated");
  }

  const activeArtists = artists.filter((a) => a.is_active);
  const inactiveArtists = artists.filter((a) => !a.is_active);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--nb-text)]">Artists</h1>
          <p className="text-sm text-[var(--nb-text-2)] mt-1">
            {artists.length} {artists.length === 1 ? "artist" : "artists"} in
            your studio
          </p>
        </div>
        <Button
          onClick={openAdd}
          className="gap-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
        >
          <Plus size={16} />
          Add Artist
        </Button>
      </div>

      {/* Empty state */}
      {artists.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--nb-border)] bg-[var(--nb-card)] py-20 text-center">
          <Users2 size={48} className="text-[var(--nb-text-2)] mb-4 opacity-40" />
          <h2 className="text-lg font-semibold text-[var(--nb-text)] mb-1">
            No artists yet
          </h2>
          <p className="text-sm text-[var(--nb-text-2)] mb-6 max-w-xs">
            Add your first artist to start tracking sessions and assignments.
          </p>
          <Button
            onClick={openAdd}
            className="gap-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white"
          >
            <Plus size={16} />
            Add Artist
          </Button>
        </div>
      )}

      {/* Active artists */}
      {activeArtists.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-medium text-[var(--nb-text-2)] uppercase tracking-wide mb-3">
            Active · {activeArtists.length}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeArtists.map((a) => (
              <ArtistCard
                key={a.id}
                artist={a}
                upcomingCount={upcomingByArtist[a.id] ?? 0}
                onOpen={() => setDetailArtist(a)}
                onEdit={(e) => openEdit(a, e)}
                onToggle={(e) => handleToggleActive(a, e)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Inactive artists */}
      {inactiveArtists.length > 0 && (
        <section className="opacity-60">
          <p className="text-xs font-medium text-[var(--nb-text-2)] uppercase tracking-wide mb-3">
            Inactive · {inactiveArtists.length}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {inactiveArtists.map((a) => (
              <ArtistCard
                key={a.id}
                artist={a}
                upcomingCount={0}
                onOpen={() => setDetailArtist(a)}
                onEdit={(e) => openEdit(a, e)}
                onToggle={(e) => handleToggleActive(a, e)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Dialogs */}
      <AddEditArtistDialog
        open={addEditOpen}
        onOpenChange={setAddEditOpen}
        artist={editingArtist}
        onSuccess={handleSaved}
      />

      {detailArtist && (
        <ArtistDetailDialog
          open={!!detailArtist}
          onOpenChange={(v) => {
            if (!v) setDetailArtist(null);
          }}
          artist={detailArtist}
          onEdit={() => {
            const a = detailArtist;
            setDetailArtist(null);
            setEditingArtist(a);
            setAddEditOpen(true);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-[var(--nb-border)] bg-[var(--nb-card)] px-4 py-3 text-sm font-medium text-[var(--nb-text)] shadow-lg animate-in slide-in-from-bottom-2 fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
