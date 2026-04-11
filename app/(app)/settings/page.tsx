import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SettingsView } from "./_components/settings-view";

export const metadata = { title: "Settings — Tatflow" };

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_name, slug, currency, bio, location, show_portfolio, portfolio_limit, show_pricing_info, pricing_note, avatar_url, flash_enabled, flash_preview_count")
    .eq("id", user.id)
    .single();

  return (
    <SettingsView
      initialStudioName={profile?.studio_name ?? ""}
      initialSlug={profile?.slug ?? ""}
      initialCurrency={profile?.currency ?? "USD"}
      initialBio={profile?.bio ?? ""}
      initialLocation={profile?.location ?? ""}
      initialShowPortfolio={profile?.show_portfolio !== false}
      initialPortfolioLimit={profile?.portfolio_limit ?? 12}
      initialShowPricingInfo={profile?.show_pricing_info ?? false}
      initialPricingNote={profile?.pricing_note ?? ""}
      initialAvatarUrl={profile?.avatar_url ?? null}
      initialFlashEnabled={profile?.flash_enabled ?? false}
      initialFlashPreviewCount={profile?.flash_preview_count ?? 6}
      userId={user.id}
    />
  );
}
