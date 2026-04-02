import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { analyzeBrief } from "@/lib/ai/analyze-brief";

export async function POST(req: NextRequest) {
  try {
    const { request_id } = await req.json();
    if (!request_id) {
      return NextResponse.json({ error: "request_id required" }, { status: 400 });
    }

    // Fetch the tattoo request along with linked client contact info
    const { data: request, error: fetchError } = await getSupabaseAdmin()
      .from("tattoo_requests")
      .select("*, clients(name, phone, instagram)")
      .eq("id", request_id)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Fetch artists for this user
    const { data: artists } = await getSupabaseAdmin()
      .from("artists")
      .select("name")
      .eq("user_id", request.user_id)
      .eq("is_active", true)
      .order("name");

    const client = request.clients as { name: string; phone: string | null; instagram: string | null } | null;
    const clientName = client?.name ?? request.client_name ?? "Unknown";

    // Parse placement/size/phone out of the packed description field
    // (manual requests pack structured fields into description as "Key: value\n")
    const descLines = (request.description ?? "").split("\n");
    let placement = request.placement ?? null;
    let size = request.size ?? null;
    let descPhone: string | null = null;
    for (const line of descLines) {
      const m = line.match(/^(Placement|Size|Phone):\s*(.+)$/);
      if (m) {
        if (m[1] === "Placement" && !placement) placement = m[2].trim();
        if (m[1] === "Size" && !size) size = m[2].trim();
        if (m[1] === "Phone") descPhone = m[2].trim();
      }
    }

    const hasPhone = !!(client?.phone || descPhone);
    const hasInstagram = !!client?.instagram;

    const analysis = analyzeBrief({
      client_name: clientName,
      description: request.description ?? "",
      style: request.style,
      placement,
      size,
      preferred_date: request.preferred_date,
      has_reference_image: !!request.reference_image_url,
      has_phone: hasPhone,
      has_instagram: hasInstagram,
      artists: (artists as { name: string }[]) ?? [],
    });

    // Save result to DB
    const { error: updateError } = await getSupabaseAdmin()
      .from("tattoo_requests")
      .update({
        ai_analysis: analysis,
        ai_analyzed_at: new Date().toISOString(),
      })
      .eq("id", request_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("[analyze-brief]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
