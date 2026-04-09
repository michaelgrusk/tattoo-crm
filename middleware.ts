import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ADMIN_EMAIL = "saltedslightly@gmail.com";

/** Routes that are publicly accessible without authentication. */
const PUBLIC_PATHS = [
  "/login",
  "/intake",
  "/waiver",
  "/api",
  "/studio",
  "/review",
  "/auth",
  "/pending-approval",
  "/rejected",
];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh the session — this updates the cookie if the token was rotated.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Allow public routes through regardless of auth state.
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (isPublic) return response;

  // Protect all other routes — redirect to /login if not authenticated.
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  const isAdmin = user.email === ADMIN_EMAIL;

  // Admin path protection — only the admin email may access /admin.
  if (pathname.startsWith("/admin")) {
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/board", request.url));
    }
    return response;
  }

  // Admins bypass approval checks entirely.
  if (isAdmin) return response;

  // Check approval_status for all other authenticated routes.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("approval_status")
    .eq("id", user.id)
    .single();

  // No profile row means the user just verified their email and the DB trigger
  // hasn't run yet (or doesn't exist) — treat as pending.
  const status = profile?.approval_status ?? "pending";
  console.log("[middleware]", pathname, "user:", user.id, "profile:", profile?.approval_status ?? "(none)", "profileError:", profileError?.code ?? null);

  if (status === "pending") {
    return NextResponse.redirect(new URL("/pending-approval", request.url));
  }
  if (status === "rejected") {
    return NextResponse.redirect(new URL("/rejected", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static  (static files)
     * - _next/image   (image optimisation)
     * - favicon.ico
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
