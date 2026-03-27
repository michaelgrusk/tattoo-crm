import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      appointment_id,
      client_name,
      client_email,
      client_phone,
      appointment_date,
      appointment_time,
      appointment_type,
    } = body as {
      appointment_id: string;
      client_name: string;
      client_email: string;
      client_phone?: string;
      appointment_date: string;
      appointment_time: string;
      appointment_type: string;
    };

    if (!client_email && !client_phone) {
      // No contact details — silently skip, not an error
      return NextResponse.json({ scheduled: false, reason: "no client contact details" });
    }

    // Auth
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch studio name from the artist's profile
    const { data: profile } = await getSupabaseAdmin()
      .from("profiles")
      .select("studio_name")
      .eq("id", user.id)
      .single();

    const studioName = profile?.studio_name ?? "Your Studio";

    await inngest.send({
      name: "needlebook/appointment.scheduled",
      data: {
        appointment_id,
        user_id: user.id,
        client_name,
        client_email,
        ...(client_phone ? { client_phone } : {}),
        appointment_date,
        appointment_time,
        appointment_type,
        studio_name: studioName,
      },
    });

    return NextResponse.json({ scheduled: true });
  } catch (err) {
    console.error("[schedule-reminders] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
