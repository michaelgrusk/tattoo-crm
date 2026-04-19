import { createBrowserClient } from "@supabase/ssr";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Aftercare Guide — ${slug}` };
}

export default async function AftercarePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, studio_name, avatar_url, brand_color, aftercare_guide, aftercare_enabled")
    .eq("slug", slug)
    .single();

  const accent = profile?.brand_color ?? "#7C3AED";

  // Not found
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0F0F16] flex items-center justify-center p-5 text-center">
        <div>
          <p className="text-white/50 text-sm">Studio not found</p>
        </div>
      </div>
    );
  }

  // Disabled or no guide
  if (!profile.aftercare_enabled || !profile.aftercare_guide) {
    return (
      <div className="min-h-screen bg-[#F5F3FF] flex flex-col items-center justify-center p-5 text-center gap-4">
        <div
          className="size-14 rounded-2xl flex items-center justify-center shadow-lg text-white text-2xl font-bold shrink-0"
          style={{ background: accent }}
        >
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={profile.studio_name ?? "Studio"}
              width={56}
              height={56}
              className="size-14 rounded-2xl object-cover"
              unoptimized
            />
          ) : (
            <span>{(profile.studio_name ?? "S")[0].toUpperCase()}</span>
          )}
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{profile.studio_name ?? "Tattoo Studio"}</p>
          <p className="text-sm text-gray-500 mt-2">Aftercare guide not available yet.</p>
          <p className="text-xs text-gray-400 mt-1">Check back after your session.</p>
        </div>
        <Link
          href={`/intake/${slug}`}
          className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: accent }}
        >
          Book a session
        </Link>
        <p className="text-xs text-gray-400 mt-6">
          Powered by <span className="font-medium" style={{ color: accent }}>Tatflow</span>
        </p>
      </div>
    );
  }

  const studioName = profile.studio_name ?? "Your Studio";
  const initial = studioName[0].toUpperCase();

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center py-12 px-4">
      {/* Studio header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div
          className="size-16 rounded-2xl flex items-center justify-center shadow-lg text-white text-2xl font-bold shrink-0 mb-4 overflow-hidden"
          style={{ background: accent }}
        >
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={studioName}
              width={64}
              height={64}
              className="size-16 rounded-2xl object-cover"
              unoptimized
            />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        <h1 className="text-xl font-semibold text-gray-900">{studioName}</h1>
        <p
          className="mt-1 text-sm font-medium"
          style={{ color: accent }}
        >
          Tattoo Aftercare Guide
        </p>
      </div>

      {/* Guide card */}
      <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Accent top bar */}
        <div className="h-1 w-full" style={{ background: accent }} />

        <div className="px-6 py-6">
          <div className="flex items-center gap-3 mb-5">
            <div
              className="size-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${accent}18` }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke={accent}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">How to care for your new tattoo</p>
              <p className="text-xs text-gray-500 mt-0.5">Follow these instructions for the best healing results</p>
            </div>
          </div>

          {/* Guide text — preserves line breaks */}
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line space-y-0">
            {profile.aftercare_guide}
          </div>
        </div>

        {/* Divider + CTA */}
        <div className="border-t border-gray-100 px-6 py-5 bg-gray-50/60 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-gray-600">Ready to book your next session?</p>
          <Link
            href={`/intake/${slug}`}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-medium shadow-sm transition-opacity hover:opacity-90"
            style={{ background: accent }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Book your next session
          </Link>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-gray-400 text-center">
        Powered by{" "}
        <span className="font-medium" style={{ color: accent }}>
          Tatflow
        </span>
      </p>
    </div>
  );
}
