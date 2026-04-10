"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Maximize2 } from "lucide-react";

type FlashPiece = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  size_guidance: string | null;
  placement_notes?: string | null;
  image_url: string | null;
  status: string;
  repeatable: boolean;
};

export function FlashLightbox({
  pieces,
  accent,
  slug,
}: {
  pieces: FlashPiece[];
  accent: string;
  slug: string;
}) {
  const [open, setOpen] = useState<FlashPiece | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const close = useCallback(() => { setOpen(null); setFullscreen(false); }, []);
  const closeFullscreen = useCallback(() => setFullscreen(false), []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (fullscreen) closeFullscreen();
        else close();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close, fullscreen, closeFullscreen]);

  // Lock scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* ── Card grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {pieces.map((piece) => (
          <div
            key={piece.id}
            className="group rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/25 transition-all cursor-pointer"
            onClick={() => setOpen(piece)}
          >
            {piece.image_url ? (
              <div className="aspect-square overflow-hidden relative">
                <Image
                  src={piece.image_url}
                  alt={piece.title}
                  width={300}
                  height={300}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  unoptimized
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold text-white bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm">
                    View details
                  </span>
                </div>
              </div>
            ) : (
              <div className="aspect-square flex items-center justify-center bg-white/5">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
            )}
            <div className="p-3">
              <p className="text-sm font-semibold text-white truncate">{piece.title}</p>
              <div className="flex items-center gap-2 mt-1 min-w-0">
                {piece.price != null && (
                  <span className="text-xs text-white/60">from ${piece.price}</span>
                )}
                {piece.size_guidance && (
                  <span className="text-xs text-white/40 truncate">{piece.size_guidance}</span>
                )}
              </div>
              <Link
                href={`/intake/${slug}?flash=${piece.id}`}
                onClick={(e) => e.stopPropagation()}
                className="mt-2.5 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                Book This Design
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* ── Lightbox overlay ─────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          onClick={close}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

          {/* Panel */}
          <div
            className="relative z-10 w-full max-w-lg bg-[#16101f] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={close}
              className="absolute top-4 right-4 z-20 size-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-colors"
            >
              <X size={16} />
            </button>

            {/* Image */}
            {open.image_url ? (
              <div className="relative w-full aspect-square sm:aspect-[4/3] shrink-0 bg-black/30 group/img">
                <Image
                  src={open.image_url}
                  alt={open.title}
                  fill
                  className="object-contain cursor-zoom-in"
                  unoptimized
                  onClick={() => setFullscreen(true)}
                />
                <button
                  onClick={() => setFullscreen(true)}
                  className="absolute bottom-3 right-3 size-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/80 transition-colors opacity-0 group-hover/img:opacity-100"
                  title="View full size"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            ) : (
              <div className="w-full aspect-square sm:aspect-[4/3] flex items-center justify-center bg-white/5 shrink-0">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
            )}

            {/* Details */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Title + status */}
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-xl font-bold text-white leading-tight">{open.title}</h3>
                <span
                  className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                    open.status === "available"
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                      : "bg-amber-500/15 text-amber-400 border border-amber-500/25"
                  }`}
                >
                  {open.status === "available" ? "Available" : "Pending"}
                </span>
              </div>

              {/* Price */}
              {open.price != null && (
                <p className="text-2xl font-bold text-white">
                  from <span style={{ color: accent }}>${open.price}</span>
                </p>
              )}

              {/* Description */}
              {open.description && (
                <p className="text-white/70 text-sm leading-relaxed">{open.description}</p>
              )}

              {/* Meta grid */}
              {(open.size_guidance || open.placement_notes || open.repeatable) && (
                <div className="grid grid-cols-2 gap-3">
                  {open.size_guidance && (
                    <div className="bg-white/5 rounded-xl px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1">Size</p>
                      <p className="text-sm text-white/80">{open.size_guidance}</p>
                    </div>
                  )}
                  {open.placement_notes && (
                    <div className="bg-white/5 rounded-xl px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1">Placement</p>
                      <p className="text-sm text-white/80">{open.placement_notes}</p>
                    </div>
                  )}
                  {open.repeatable && (
                    <div className="bg-white/5 rounded-xl px-4 py-3 col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1">Availability</p>
                      <p className="text-sm text-white/80">Repeatable design — can be done multiple times</p>
                    </div>
                  )}
                </div>
              )}

              {/* CTA */}
              <Link
                href={`/intake/${slug}?flash=${open.id}`}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                style={{ backgroundColor: accent }}
              >
                Book This Design
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Full-screen image view ───────────────────────────────────────── */}
      {fullscreen && open?.image_url && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95"
          onClick={closeFullscreen}
        >
          <button
            onClick={closeFullscreen}
            className="absolute top-4 right-4 z-10 size-9 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors"
          >
            <X size={18} />
          </button>
          <div className="relative w-full h-full p-4 sm:p-8" onClick={(e) => e.stopPropagation()}>
            <Image
              src={open.image_url}
              alt={open.title}
              fill
              className="object-contain"
              unoptimized
              onClick={closeFullscreen}
            />
          </div>
        </div>
      )}
    </>
  );
}
