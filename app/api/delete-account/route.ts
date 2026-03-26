import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;
  const admin = getSupabaseAdmin();

  // Delete all user data across every table (in dependency order)
  await Promise.all([
    admin.from("invoices").delete().eq("user_id", userId),
    admin.from("appointments").delete().eq("user_id", userId),
    admin.from("tattoo_requests").delete().eq("user_id", userId),
    admin.from("clients").delete().eq("user_id", userId),
  ]);
  await admin.from("profiles").delete().eq("id", userId);

  // Hard-delete the auth user
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("[delete-account] deleteUser error:", deleteError);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
