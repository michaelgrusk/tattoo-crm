import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "./_components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialCurrency = "USD";
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("currency")
      .eq("id", user.id)
      .single();
    if (data?.currency) initialCurrency = data.currency;
  }

  return <AppShell initialCurrency={initialCurrency}>{children}</AppShell>;
}
