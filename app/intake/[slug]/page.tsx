import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SlugIntakeForm } from "./_components/slug-intake-form";

export default async function SlugIntakePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, studio_name, slug")
    .eq("slug", slug)
    .single();

  if (!profile) notFound();

  return (
    <SlugIntakeForm
      studioName={profile.studio_name ?? ""}
      slug={slug}
      userId={profile.id}
    />
  );
}
