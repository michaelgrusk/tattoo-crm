import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SlugIntakeForm } from "./_components/slug-intake-form";
import type { IntakeAvailabilityBlock } from "./_components/availability-date-picker";

export type FlashPiecePreview = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  size_guidance: string | null;
  image_url: string | null;
};

export default async function SlugIntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const preselectedFlashId = typeof sp.flash === "string" ? sp.flash : null;

  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, studio_name, slug, flash_enabled, availability_strict_mode")
    .eq("slug", slug)
    .single();

  if (!profile) notFound();

  // Fetch availability blocks for date picker
  const today = new Date().toISOString().split("T")[0];
  const { data: availabilityData } = await supabase
    .from("availability_blocks")
    .select("start_date, end_date, block_type, label, is_full_day, start_time, end_time")
    .eq("user_id", profile.id)
    .gte("end_date", today)
    .order("start_date", { ascending: true });
  const availabilityBlocks: IntakeAvailabilityBlock[] = (availabilityData as IntakeAvailabilityBlock[]) ?? [];

  let flashPieces: FlashPiecePreview[] = [];
  if (profile.flash_enabled) {
    const { data } = await supabase
      .from("flash_pieces")
      .select("id, title, description, price, size_guidance, image_url")
      .eq("user_id", profile.id)
      .in("status", ["available", "pending"])
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    flashPieces = (data as FlashPiecePreview[]) ?? [];
  }

  return (
    <SlugIntakeForm
      studioName={profile.studio_name ?? ""}
      slug={slug}
      userId={profile.id}
      flashPieces={flashPieces}
      preselectedFlashId={preselectedFlashId}
      availabilityBlocks={availabilityBlocks}
      strictMode={profile.availability_strict_mode ?? false}
    />
  );
}
