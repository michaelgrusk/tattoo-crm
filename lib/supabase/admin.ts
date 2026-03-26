import { createClient } from "@supabase/supabase-js";

// Server-only admin client — never import this in client components.
// Created lazily so build doesn't fail if SUPABASE_SERVICE_ROLE_KEY isn't set.
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY env var");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
