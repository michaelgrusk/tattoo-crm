import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ArtistsView } from "./_components/artists-view";

export type Artist = {
  id: number;
  created_at: string;
  name: string;
  bio: string | null;
  styles: string[];
  years_experience: number | null;
  instagram: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

export default async function ArtistsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: artists } = await supabase
    .from("artists")
    .select("*")
    .eq("user_id", user?.id)
    .order("name");

  return <ArtistsView artists={(artists as Artist[]) ?? []} />;
}
