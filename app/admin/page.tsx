import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminView } from "./_components/admin-view";

const ADMIN_EMAIL = "saltedslightly@gmail.com";

export const metadata = { title: "Admin — Needlebook" };

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) redirect("/board");

  return <AdminView />;
}
