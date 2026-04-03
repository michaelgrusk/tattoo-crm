import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const supabase = await createSupabaseServerClient();

  // PKCE code exchange (used by resetPasswordForEmail redirectTo flow)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // code from a password reset → send to reset page; otherwise board
      const next = type === "recovery" ? "/auth/reset-password" : "/board";
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Token hash flow (used by email confirmation links)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "email" | "recovery" | "email_change" | "invite",
    });
    if (!error) {
      const next = type === "recovery" ? "/auth/reset-password" : "/board";
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=verification_failed`);
}
