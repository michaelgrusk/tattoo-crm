import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { StudioLightbox } from "./_components/studio-lightbox";

export const revalidate = 60;

const STYLE_COLORS: Record<string, string> = {
  Blackwork: "bg-gray-800 text-gray-100",
  Japanese: "bg-red-700 text-red-50",
  "Fine line": "bg-slate-600 text-slate-100",
  Watercolor: "bg-sky-500 text-sky-50",
  Geometric: "bg-indigo-600 text-indigo-50",
  Traditional: "bg-amber-600 text-amber-50",
  Realism: "bg-neutral-600 text-neutral-100",
  "Neo-traditional": "bg-rose-600 text-rose-50",
  Tribal: "bg-stone-700 text-stone-100",
  Portrait: "bg-teal-600 text-teal-50",
  Anime: "bg-pink-600 text-pink-50",
  Other: "bg-zinc-600 text-zinc-100",
};

export default async function StudioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  try {
    const { slug } = await params;
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("slug", slug)
      .single();

    if (!profile) {
      notFound();
    }

    const accent = profile.brand_color ?? "#7C3AED";
    const intakeUrl = `/intake/${slug}`;
    const portfolioLimit = profile.portfolio_limit ?? 12;

    const { data: artistRows } = await supabase
      .from("artists")
      .select("styles")
      .eq("user_id", profile.id);

    const allStyles: string[] = [];
    for (const row of artistRows ?? []) {
      for (const s of row.styles ?? []) {
        if (s && !allStyles.includes(s)) allStyles.push(s);
      }
    }

    const flashEnabled = profile.flash_enabled === true;
    const flashPreviewCount = profile.flash_preview_count ?? 6;
    let flashPieces: { id: string; title: string; description: string | null; price: number | null; size_guidance: string | null; image_url: string | null; status: string; repeatable: boolean }[] = [];
    if (flashEnabled) {
      const { data: flashData } = await supabase
        .from("flash_pieces")
        .select("id, title, description, price, size_guidance, image_url, status, repeatable")
        .eq("user_id", profile.id)
        .eq("status", "available")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(flashPreviewCount);
      flashPieces = flashData ?? [];
    }

    const showPortfolio = profile.show_portfolio !== false;
    let portfolioItems: { id: number; photo_url: string; style: string | null }[] = [];
    if (showPortfolio) {
      const { data: photos } = await supabase
        .from("completed_tattoos")
        .select("id, photo_url, style")
        .eq("user_id", profile.id)
        .not("photo_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(portfolioLimit);
      portfolioItems = (photos ?? []).filter((p: { id: number; photo_url: string | null; style: string | null }) => p.photo_url);
    }

    return (
      <div className="min-h-screen bg-[#0F0F16] text-white">

        {/* ── HEADER ─────────────────────────────────────────────────────────── */}
        <header className="relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: `radial-gradient(ellipse at 60% 0%, ${accent}55 0%, transparent 70%)`,
            }}
          />

          <div className="relative mx-auto max-w-3xl px-5 py-14 sm:py-20 text-center">
            <div className="flex justify-center mb-6">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.studio_name ?? "Studio avatar"}
                  width={80}
                  height={80}
                  className="size-20 rounded-full object-cover ring-4 ring-white/10"
                  unoptimized
                />
              ) : (
                <div
                  className="size-20 rounded-full flex items-center justify-center text-3xl font-bold text-white ring-4 ring-white/10"
                  style={{ backgroundColor: accent }}
                >
                  {profile.studio_name ? profile.studio_name[0].toUpperCase() : "?"}
                </div>
              )}
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-3">
              {profile.studio_name ?? "Tattoo Studio"}
            </h1>

            {profile.location && (
              <div className="flex items-center justify-center gap-1.5 text-white/60 text-sm mb-4">
                <MapPin size={14} className="shrink-0" />
                <span>{profile.location}</span>
              </div>
            )}

            {profile.bio && (
              <p className="text-white/70 text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-6">
                {profile.bio}
              </p>
            )}

            <Link
              href={intakeUrl}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-white text-base font-semibold transition-all hover:opacity-90 active:scale-95 shadow-lg"
              style={{ backgroundColor: accent }}
            >
              Book Now
            </Link>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-px bg-white/8" />
        </header>

        {/* ── STYLES ─────────────────────────────────────────────────────────── */}
        {allStyles.length > 0 && (
          <section className="mx-auto max-w-3xl px-5 py-12">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-4">
              Specializes in
            </h2>
            <div className="flex flex-wrap gap-2">
              {allStyles.map((style) => (
                <span
                  key={style}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${STYLE_COLORS[style] ?? "bg-zinc-700 text-zinc-100"}`}
                >
                  {style}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── FLASH ──────────────────────────────────────────────────────────── */}
        {flashEnabled && flashPieces.length > 0 && (
          <section className="mx-auto max-w-3xl px-5 py-12 border-t border-white/8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-white/40">
                Flash Available
              </h2>
              <span className="text-xs text-white/30">{flashPieces.length} design{flashPieces.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {flashPieces.map((piece) => (
                <div key={piece.id} className="group rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-all">
                  {piece.image_url ? (
                    <div className="aspect-square overflow-hidden">
                      <Image
                        src={piece.image_url}
                        alt={piece.title}
                        width={300}
                        height={300}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        unoptimized
                      />
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
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {piece.price != null && (
                          <span className="text-xs text-white/60">${piece.price}</span>
                        )}
                        {piece.size_guidance && (
                          <span className="text-xs text-white/40 truncate">{piece.size_guidance}</span>
                        )}
                        {piece.repeatable && (
                          <span className="text-[10px] text-white/30">repeatable</span>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/intake/${slug}?flash=${piece.id}`}
                      className="mt-2.5 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                      style={{ backgroundColor: accent }}
                    >
                      Book This Design
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── PORTFOLIO ──────────────────────────────────────────────────────── */}
        {showPortfolio && portfolioItems.length > 0 && (
          <section className="mx-auto max-w-3xl px-5 py-12 border-t border-white/8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-6">
              Recent Work
            </h2>
            <StudioLightbox items={portfolioItems} styleColors={STYLE_COLORS} />
          </section>
        )}

        {/* ── PRICING ────────────────────────────────────────────────────────── */}
        {profile.show_pricing_info && profile.pricing_note && (
          <section className="mx-auto max-w-3xl px-5 py-12 border-t border-white/8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-4">
              Pricing
            </h2>
            <p className="text-white/80 text-base leading-relaxed mb-6">
              {profile.pricing_note}
            </p>
            <Link
              href={intakeUrl}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              Get a Quote
            </Link>
          </section>
        )}

        {/* ── FOOTER CTA ─────────────────────────────────────────────────────── */}
        <section
          className="mt-8 border-t border-white/8 relative overflow-hidden"
          style={{ background: `linear-gradient(to bottom, #0F0F16, #16101f)` }}
        >
          <div
            className="absolute inset-0 opacity-15"
            style={{
              background: `radial-gradient(ellipse at 50% 100%, ${accent}88 0%, transparent 65%)`,
            }}
          />
          <div className="relative mx-auto max-w-3xl px-5 py-20 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Ready to book?
            </h2>
            <p className="text-white/60 text-base mb-8 max-w-md mx-auto">
              Fill out our intake form and we&apos;ll get back to you with a quote.
            </p>
            <Link
              href={intakeUrl}
              className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl text-white text-base font-semibold transition-all hover:opacity-90 active:scale-95 shadow-xl"
              style={{ backgroundColor: accent }}
            >
              Book Your Tattoo
            </Link>
          </div>
        </section>

        {/* ── POWERED BY ─────────────────────────────────────────────────────── */}
        <div className="py-5 text-center border-t border-white/5">
          <a
            href="https://needlebook.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/25 hover:text-white/50 transition-colors"
          >
            Powered by Needlebook
          </a>
        </div>
      </div>
    );
  } catch {
    notFound();
  }
}
