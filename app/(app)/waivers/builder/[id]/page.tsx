import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WaiverBuilder } from "./_components/waiver-builder";
import { DEFAULT_SECTIONS } from "../../types";
import type { WaiverSection } from "../../types";

export default async function WaiverBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isNew = id === "new";
  let initialName = "";
  let initialSections: WaiverSection[] = DEFAULT_SECTIONS;
  let templateId: number | null = null;

  if (!isNew) {
    const parsedId = parseInt(id);
    if (isNaN(parsedId)) redirect("/waivers");

    const { data, error } = await supabase
      .from("waiver_templates")
      .select("*")
      .eq("id", parsedId)
      .eq("user_id", user.id)
      .single();

    if (error || !data) redirect("/waivers");

    templateId = parsedId;
    initialName = data.name;
    initialSections = (data.sections as WaiverSection[]) ?? DEFAULT_SECTIONS;
  }

  return (
    <WaiverBuilder
      templateId={templateId}
      initialName={initialName}
      initialSections={initialSections}
    />
  );
}
