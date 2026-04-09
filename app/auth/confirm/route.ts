import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  console.log("[auth/confirm] token_hash:", !!token_hash, "type:", type, "code:", !!code);

  const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    }
  );

  let destination = `${origin}/login?error=verification_failed`;

  // PKCE code exchange (used by resetPasswordForEmail redirectTo flow)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    console.log("[auth/confirm] exchangeCodeForSession error:", error?.message ?? null);
    if (!error) {
      destination = type === "recovery"
        ? `${origin}/auth/reset-password`
        : `${origin}/board`;
    }
  }

  // Token hash flow — Supabase sends type=signup for email confirmations (not type=email)
  // Both 'signup' and 'email' are valid and map to the same operation.
  if (!code && token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      // Cast to any to allow 'signup' which Supabase sends but isn't in older SDK typings
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: type as any,
    });
    console.log("[auth/confirm] verifyOtp type:", type, "error:", error?.message ?? null);

    if (!error) {
      if (type === "recovery") {
        destination = `${origin}/auth/reset-password`;
      } else {
        // Email verification (signup/email) — ensure profile row exists before redirecting
        const { data: { user } } = await supabase.auth.getUser();
        console.log("[auth/confirm] verified user:", user?.id ?? null);

        if (user) {
          // Upsert profile so new users without a DB trigger still get a row
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert(
              {
                id: user.id,
                studio_name: (user.user_metadata?.studio_name as string | null) ?? null,
                approval_status: "pending",
              },
              { onConflict: "id", ignoreDuplicates: true }
            );
          console.log("[auth/confirm] profile upsert error:", profileError?.message ?? null);
        }

        destination = `${origin}/board`;
      }
    }
  }

  console.log("[auth/confirm] destination:", destination, "cookies:", pendingCookies.length);

  const response = NextResponse.redirect(destination);
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
  });

  return response;
}
