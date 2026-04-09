"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Palette,
  Loader2,
  ArrowUpRight,
  Users,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { supabase, getUserId } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type PortfolioTattoo = {
  id: number;
  created_at: string;
  client_id: number;
  photo_url: string | null;
  style: string | null;
  placement: string | null;
  notes: string | null;
  session_date: string | null;
  is_walk_in: boolean;
  artists: { name: string } | null;
  clients: { id: number; name: string } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STYLE_FILTERS = [
  "Blackwork", "Japanese", "Fine line", "Watercolor", "Geometric",
  "Traditional", "Realism", "Neo-traditional", "Tribal", "Portrait", "Anime", "Other",
];

const STYLE_COLORS: Record<string, { text: string; bg: string }> = {
  "Blackwork":       { text: "text-gray-700",    bg: "bg-gray-100 dark:bg-gray-800 dark:text-gray-300" },
  "Japanese":        { text: "text-red-700",      bg: "bg-red-50" },
  "Fine line":       { text: "text-sky-700",      bg: "bg-sky-50" },
  "Watercolor":      { text: "text-cyan-700",     bg: "bg-cyan-50" },
  "Geometric":       { text: "text-violet-700",   bg: "bg-violet-50" },
  "Traditional":     { text: "text-amber-700",    bg: "bg-amber-50" },
  "Realism":         { text: "text-emerald-700",  bg: "bg-emerald-50" },
  "Neo-traditional": { text: "text-orange-700",   bg: "bg-orange-50" },
  "Tribal":          { text: "text-stone-700",    bg: "bg-stone-100" },
  "Portrait":        { text: "text-rose-700",     bg: "bg-rose-50" },
  "Anime":           { text: "text-pink-700",     bg: "bg-pink-50" },
};

// Placeholder gradient backgrounds for no-photo cards
const PLACEHOLDER_GRADIENTS = [
  "from-violet-500/20 to-purple-600/20",
  "from-sky-500/20 to-blue-600/20",
  "from-emerald-500/20 to-teal-600/20",
  "from-rose-500/20 to-pink-600/20",
  "from-amber-500/20 to-orange-600/20",
  "from-cyan-500/20 to-indigo-600/20",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function styleColor(style: string | null) {
  if (!style) return { text: "text-[var(--nb-text-2)]", bg: "bg-[var(--nb-border)]" };
  return STYLE_COLORS[style] ?? { text: "text-[var(--nb-text-2)]", bg: "bg-[var(--nb-border)]" };
}

function fmtDate(str: string | null) {
  if (!str) return null;
  return new Date(str + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function placeholderGradient(id: number) {
  return PLACEHOLDER_GRADIENTS[id % PLACEHOLDER_GRADIENTS.length];
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({
  item,
  photoItems,
  onClose,
  onNav,
}: {
  item: PortfolioTattoo;
  photoItems: PortfolioTattoo[];
  onClose: () => void;
  onNav: (item: PortfolioTattoo) => void;
}) {
  const idx = photoItems.findIndex((p) => p.id === item.id);
  const hasPrev = idx > 0;
  const hasNext = idx < photoItems.length - 1;
  const sc = styleColor(item.style);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onNav(photoItems[idx - 1]);
      if (e.key === "ArrowRight" && hasNext) onNav(photoItems[idx + 1]);
    },
    [onClose, onNav, hasPrev, hasNext, photoItems, idx]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [handleKey]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 size-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
      >
        <X size={20} />
      </button>

      {/* Prev */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onNav(photoItems[idx - 1]); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 size-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Next */}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNav(photoItems[idx + 1]); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 size-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Content */}
      <div
        className="flex flex-col lg:flex-row max-w-5xl w-full mx-4 max-h-[92vh] rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Photo */}
        <div className="flex-1 bg-black flex items-center justify-center min-h-[50vh] lg:min-h-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.photo_url!}
            alt={item.style ?? "Tattoo"}
            className="max-w-full max-h-[70vh] lg:max-h-[92vh] object-contain"
          />
        </div>

        {/* Metadata panel */}
        <div className="w-full lg:w-72 bg-[var(--nb-card)] flex flex-col overflow-y-auto shrink-0">
          <div className="px-5 py-5 space-y-4">
            {/* Style badge */}
            {item.style && (
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${sc.text} ${sc.bg}`}>
                {item.style}
              </span>
            )}

            {/* Details */}
            <div className="space-y-3">
              {item.placement && (
                <div>
                  <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">Placement</p>
                  <p className="text-sm text-[var(--nb-text)]">{item.placement}</p>
                </div>
              )}
              {item.session_date && (
                <div>
                  <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">Date</p>
                  <p className="text-sm text-[var(--nb-text)]">{fmtDate(item.session_date)}</p>
                </div>
              )}
              {item.artists?.name && (
                <div>
                  <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">Artist</p>
                  <p className="text-sm text-[var(--nb-text)]">{item.artists.name}</p>
                </div>
              )}
              {item.notes && (
                <div>
                  <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-0.5">Notes</p>
                  <p className="text-sm text-[var(--nb-text)] leading-relaxed">{item.notes}</p>
                </div>
              )}
            </div>

            {/* Client link */}
            {item.clients && (
              <div className="pt-3 border-t border-[var(--nb-border)]">
                <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide mb-1.5">Client</p>
                <Link
                  href={"/contacts?client=" + item.clients.id}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#7C3AED] hover:underline"
                >
                  {item.clients.name}
                  <ArrowUpRight size={13} />
                </Link>
              </div>
            )}

            {/* Counter */}
            <p className="text-[10px] text-[var(--nb-text-2)] pt-1">
              {idx + 1} of {photoItems.length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-[var(--nb-card)] rounded-xl border border-[var(--nb-border)] px-5 py-4 flex items-center gap-3">
      <div className="size-9 rounded-lg bg-[var(--nb-active-bg)] flex items-center justify-center shrink-0">
        <Icon size={16} className="text-[#7C3AED]" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-[var(--nb-text-2)] uppercase tracking-wide">{label}</p>
        <p className="text-base font-semibold text-[var(--nb-text)] truncate">{value || "—"}</p>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function PortfolioView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const highlightId = searchParams.get("highlight");

  const [all, setAll] = useState<PortfolioTattoo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [styleFilter, setStyleFilter] = useState<string | null>(null);
  const [artistFilter, setArtistFilter] = useState<string>("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [lightboxItem, setLightboxItem] = useState<PortfolioTattoo | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  // Fetch all completed tattoos
  useEffect(() => {
    getUserId().then(async (uid) => {
      if (!uid) { setLoading(false); return; }
      const { data } = await supabase
        .from("completed_tattoos")
        .select("*, artists(name), clients(id, name)")
        .eq("user_id", uid)
        .order("session_date", { ascending: false });
      setAll((data as unknown as PortfolioTattoo[]) ?? []);
      setLoading(false);
    });
  }, []);

  // Scroll to highlighted card after data loads
  useEffect(() => {
    if (!highlightId || loading) return;
    const el = document.getElementById(`tattoo-${highlightId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-[#7C3AED]", "ring-offset-2");
    const t = setTimeout(() => {
      el.classList.remove("ring-2", "ring-[#7C3AED]", "ring-offset-2");
      // Clean up URL param without re-render
      router.replace("/portfolio", { scroll: false });
    }, 2500);
    return () => clearTimeout(t);
  }, [highlightId, loading, router]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const q = search.toLowerCase().trim();

  const filtered = all
    .filter((ct) => {
      if (styleFilter && ct.style !== styleFilter) return false;
      if (artistFilter && ct.artists?.name !== artistFilter) return false;
      if (q) {
        const haystack = [ct.style, ct.placement, ct.notes, ct.artists?.name, ct.clients?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const da = a.session_date ?? a.created_at;
      const db = b.session_date ?? b.created_at;
      return sort === "newest"
        ? db.localeCompare(da)
        : da.localeCompare(db);
    });

  const photoItems = filtered.filter((ct) => ct.photo_url);

  // Stats (from all, not filtered)
  const totalPieces = all.length;

  const styleCounts: Record<string, number> = {};
  for (const ct of all) {
    if (ct.style) styleCounts[ct.style] = (styleCounts[ct.style] ?? 0) + 1;
  }
  const topStyle = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const artistCounts: Record<string, number> = {};
  for (const ct of all) {
    if (ct.artists?.name) artistCounts[ct.artists.name] = (artistCounts[ct.artists.name] ?? 0) + 1;
  }
  const topArtist = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Unique artists for dropdown
  const artistOptions = [...new Set(all.map((ct) => ct.artists?.name).filter(Boolean) as string[])].sort();

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={20} className="animate-spin text-[var(--nb-text-2)]" />
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────

  if (all.length === 0) {
    return (
      <div className="p-4 md:p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[var(--nb-text)]">Portfolio</h1>
          <p className="mt-1 text-sm text-[var(--nb-text-2)]">Your studio&apos;s completed work</p>
        </div>
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border border-dashed border-[var(--nb-border)] bg-[var(--nb-card)]">
          <div className="size-16 rounded-2xl bg-[var(--nb-active-bg)] flex items-center justify-center mb-4">
            <Palette size={28} className="text-[#7C3AED]" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--nb-text)] mb-2">Your portfolio is empty</h2>
          <p className="text-sm text-[var(--nb-text-2)] mb-6 max-w-sm">
            Start by logging completed tattoos on client profiles. They&apos;ll appear here automatically.
          </p>
          <Link
            href="/contacts"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-sm font-medium transition-colors"
          >
            Go to Contacts
          </Link>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--nb-text)]">Portfolio</h1>
            <p className="mt-1 text-sm text-[var(--nb-text-2)]">Your studio&apos;s completed work</p>
          </div>
          <span className="text-sm font-medium text-[var(--nb-text-2)] bg-[var(--nb-card)] border border-[var(--nb-border)] rounded-full px-3 py-1">
            {totalPieces} {totalPieces === 1 ? "piece" : "pieces"}
          </span>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Total Pieces" value={String(totalPieces)} icon={Layers} />
          <StatCard label="Most Popular Style" value={topStyle ?? "—"} icon={Palette} />
          <StatCard label="Most Active Artist" value={topArtist ?? "—"} icon={Users} />
        </div>

        {/* Filter bar */}
        <div className="space-y-3">
          {/* Search + sort row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--nb-text-2)] pointer-events-none" />
              <input
                type="text"
                placeholder="Search style, placement, notes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--nb-card)] border border-[var(--nb-border)] rounded-lg outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-colors placeholder:text-[var(--nb-text-2)] text-[var(--nb-text)]"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Artist filter */}
            {artistOptions.length > 0 && (
              <select
                value={artistFilter}
                onChange={(e) => setArtistFilter(e.target.value)}
                className="h-9 px-2.5 text-sm bg-[var(--nb-card)] border border-[var(--nb-border)] rounded-lg outline-none focus:border-[#7C3AED] text-[var(--nb-text)] transition-colors"
              >
                <option value="">All artists</option>
                {artistOptions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            )}

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
              className="h-9 px-2.5 text-sm bg-[var(--nb-card)] border border-[var(--nb-border)] rounded-lg outline-none focus:border-[#7C3AED] text-[var(--nb-text)] transition-colors"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          {/* Style pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setStyleFilter(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                styleFilter === null
                  ? "bg-[#7C3AED] text-white"
                  : "bg-[var(--nb-card)] border border-[var(--nb-border)] text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
              }`}
            >
              All
            </button>
            {STYLE_FILTERS.map((s) => {
              const active = styleFilter === s;
              const sc = styleColor(s);
              return (
                <button
                  key={s}
                  onClick={() => setStyleFilter(active ? null : s)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? `${sc.bg} ${sc.text} ring-1 ring-current/30`
                      : "bg-[var(--nb-card)] border border-[var(--nb-border)] text-[var(--nb-text-2)] hover:text-[var(--nb-text)]"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>

          {/* Results count */}
          {(search || styleFilter || artistFilter) && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--nb-text-2)]">
                {filtered.length} {filtered.length === 1 ? "result" : "results"}
              </p>
              <button
                onClick={() => { setSearch(""); setStyleFilter(null); setArtistFilter(""); }}
                className="text-xs text-[#7C3AED] hover:underline"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Gallery grid — masonry via CSS columns */}
        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-center rounded-2xl border border-dashed border-[var(--nb-border)] bg-[var(--nb-card)]">
            <Palette size={28} className="text-[var(--nb-border)] mb-3" />
            <p className="text-sm font-medium text-[var(--nb-text-2)]">No tattoos match your filters</p>
            <button
              onClick={() => { setSearch(""); setStyleFilter(null); setArtistFilter(""); }}
              className="mt-3 text-xs text-[#7C3AED] hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
            {filtered.map((ct) => {
              const sc = styleColor(ct.style);
              const date = fmtDate(ct.session_date);
              const grad = placeholderGradient(ct.id);

              return (
                <div
                  key={ct.id}
                  id={`tattoo-${ct.id}`}
                  ref={highlightId === String(ct.id) ? highlightRef : undefined}
                  className="break-inside-avoid mb-3 group relative bg-[var(--nb-card)] rounded-2xl border border-[var(--nb-border)] overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-[#7C3AED]/30"
                >
                  {/* Photo or placeholder */}
                  {ct.photo_url ? (
                    <button
                      type="button"
                      onClick={() => setLightboxItem(ct)}
                      className="block w-full"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ct.photo_url}
                        alt={ct.style ?? "Tattoo"}
                        className="w-full h-auto object-cover group-hover:brightness-90 transition-all duration-300"
                        loading="lazy"
                      />
                    </button>
                  ) : (
                    <div className={`w-full h-28 bg-gradient-to-br ${grad} flex items-center justify-center`}>
                      <Palette size={22} className="text-[#7C3AED]/40" />
                    </div>
                  )}

                  {/* Card body */}
                  <div className="px-3 py-2.5 space-y-1.5">
                    {/* Style badge */}
                    {ct.style && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.text} ${sc.bg}`}>
                        {ct.style}
                      </span>
                    )}

                    {/* Placement */}
                    {ct.placement && (
                      <p className="text-xs font-medium text-[var(--nb-text)] leading-snug">
                        {ct.placement}
                      </p>
                    )}

                    {/* Date + artist */}
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                      {date && (
                        <p className="text-[10px] text-[var(--nb-text-2)]">{date}</p>
                      )}
                      {ct.artists?.name && (
                        <p className="text-[10px] text-[var(--nb-text-2)]">· {ct.artists.name}</p>
                      )}
                    </div>

                    {/* Notes preview */}
                    {ct.notes && (
                      <p className="text-[10px] text-[var(--nb-text-2)] line-clamp-2 leading-relaxed">
                        {ct.notes}
                      </p>
                    )}

                    {/* Footer: client name + walk-in badge */}
                    <div className="flex items-center justify-between pt-1 border-t border-[var(--nb-border)]">
                      <span className="text-[10px] text-[var(--nb-text-2)] truncate max-w-[60%]">
                        {ct.is_walk_in ? (
                          <span className="text-amber-600 font-medium">Walk-in</span>
                        ) : (
                          ct.clients?.name ?? "Client"
                        )}
                      </span>

                      {/* View Client button (visible on hover) */}
                      {ct.clients && (
                        <Link
                          href={"/contacts?client=" + ct.clients.id}
                          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-0.5 text-[10px] font-medium text-[#7C3AED] hover:underline shrink-0"
                        >
                          View client
                          <ArrowUpRight size={10} />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxItem && (
        <Lightbox
          item={lightboxItem}
          photoItems={photoItems}
          onClose={() => setLightboxItem(null)}
          onNav={setLightboxItem}
        />
      )}
    </>
  );
}
