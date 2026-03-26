import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WaiversView } from "./_components/waivers-view";
import type { WaiverTemplate, SignedWaiver } from "./types";

export const metadata = { title: "Waivers — Needlebook" };

export default async function WaiversPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: templates }, { data: signed }] = await Promise.all([
    supabase
      .from("waiver_templates")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("signed_waivers")
      .select("*, waiver_templates(name)")
      .order("signed_at", { ascending: false })
      .limit(200),
  ]);

  return (
    <WaiversView
      templates={(templates as WaiverTemplate[]) ?? []}
      signedWaivers={(signed as unknown as SignedWaiver[]) ?? []}
    />
  );
}
