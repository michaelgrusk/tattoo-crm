import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      template_id,
      user_id,
      client_name,
      client_email,
      responses,
      signature_type,
      signature_data,
    } = body;

    if (!template_id || !user_id || !client_name || !responses) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Look up client_id by email + user_id (bypasses RLS)
    let client_id: number | null = null;
    if (client_email) {
      const { data: client } = await admin
        .from("clients")
        .select("id")
        .eq("user_id", user_id)
        .eq("email", client_email.toLowerCase().trim())
        .single();
      client_id = client?.id ?? null;
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      request.headers.get("x-real-ip") ??
      null;

    const { data, error } = await admin
      .from("signed_waivers")
      .insert({
        template_id,
        user_id,
        client_id,
        client_name: client_name.trim(),
        client_email: client_email ? client_email.toLowerCase().trim() : null,
        responses,
        signature_type: signature_type ?? null,
        signature_data: signature_data ?? null,
        signed_at: new Date().toISOString(),
        ip_address: ip,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
