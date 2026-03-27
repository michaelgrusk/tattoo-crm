import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SettingsView } from "./_components/settings-view";

export const metadata = { title: "Settings — Needlebook" };

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_name, slug, currency")
    .eq("id", user.id)
    .single();

  return (
    <SettingsView
      initialStudioName={profile?.studio_name ?? ""}
      initialSlug={profile?.slug ?? ""}
      initialCurrency={profile?.currency ?? "USD"}
    />
  );
}
