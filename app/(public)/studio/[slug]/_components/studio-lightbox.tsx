"use client";

import { useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type Item = { id: number; photo_url: string; style: string | null };

export function StudioLightbox({
  items,
  styleColors,
}: {
  items: Item[];
  styleColors: Record<string, string>;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  function prev() {
    setLightboxIndex((i) => (i == null ? 0 : (i - 1 + items.length) % items.length));
  }
  function next() {
    setLightboxIndex((i) => (i == null ? 0 : (i + 1) % items.length));
  }

  return (
    <>
      {/* Masonry-style grid */}
      <div className="columns-2 sm:columns-3 gap-3 space-y-3">
        {items.map((item, idx) => (
          <button
            key={item.id}
            onClick={() => setLightboxIndex(idx)}
            className="relative w-full break-inside-avoid rounded-xl overflow-hidden group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <Image
              src={item.photo_url}
              alt={item.style ?? "Tattoo"}
              width={400}
              height={400}
              className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
              unoptimized
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
            {item.style && (
              <span
                className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity ${
                  styleColors[item.style] ?? "bg-zinc-700 text-zinc-100"
                }`}
              >
                {item.style}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox overlay */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 size-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {items.length > 1 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); prev(); }}
              aria-label="Previous"
            >
              <ChevronLeft size={22} />
            </button>
          )}

          <div
            className="relative max-h-[85vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={items[lightboxIndex].photo_url}
              alt={items[lightboxIndex].style ?? "Tattoo"}
              width={900}
              height={900}
              className="max-h-[85vh] max-w-[90vw] w-auto h-auto object-contain rounded-xl"
              unoptimized
            />
            {items[lightboxIndex].style && (
              <span
                className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  styleColors[items[lightboxIndex].style!] ?? "bg-zinc-700 text-zinc-100"
                }`}
              >
                {items[lightboxIndex].style}
              </span>
            )}
          </div>

          {items.length > 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); next(); }}
              aria-label="Next"
            >
              <ChevronRight size={22} />
            </button>
          )}

          {items.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">
              {lightboxIndex + 1} / {items.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}
