import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function StudioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  console.log("[studio] slug:", slug);

  const supabase = await createSupabaseServerClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, studio_name, slug")
    .eq("slug", slug)
    .single();

  console.log("[studio] profile:", JSON.stringify(profile));
  console.log("[studio] error:", JSON.stringify(error));

  return (
    <div style={{ padding: 40, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
      <h2>Debug — studio page</h2>
      <p><strong>slug received:</strong> {slug}</p>
      <p><strong>profile:</strong> {JSON.stringify(profile, null, 2)}</p>
      <p><strong>error:</strong> {JSON.stringify(error, null, 2)}</p>
    </div>
  );
}
