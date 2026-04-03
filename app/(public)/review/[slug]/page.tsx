import { createBrowserClient } from "@supabase/ssr";
import { ReviewForm } from "./_components/review-form";

export const revalidate = 60;

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, studio_name, avatar_url, brand_color")
    .eq("slug", slug)
    .single();

  console.log("[review page] slug:", slug, "profile:", profile, "error:", error);

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0F0F16] flex items-center justify-center p-5 text-center">
        <div>
          <p className="text-white/50 text-sm">Studio not found</p>
          <p className="text-white/25 text-xs mt-1">slug: {slug}</p>
          {error && <p className="text-red-400 text-xs mt-1">{error.message}</p>}
        </div>
      </div>
    );
  }

  return (
    <ReviewForm
      studioName={profile.studio_name ?? "Tattoo Studio"}
      avatarUrl={profile.avatar_url ?? null}
      accent={profile.brand_color ?? "#7C3AED"}
      studioUserId={profile.id}
    />
  );
}
