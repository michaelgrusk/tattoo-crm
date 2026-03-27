import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContactsView } from "./_components/contacts-view";

export type ClientListItem = {
  id: string | number;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  notes: string | null;
  skin_notes: string | null;
  status: string | null;
  sessions: number;
  totalSpent: number;
};

export default async function ContactsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  const [
    { data: clients },
    { data: appts },
    { data: invoices },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("user_id", userId).order("name"),
    supabase.from("appointments").select("client_id").eq("user_id", userId),
    supabase.from("invoices").select("client_id, amount").eq("user_id", userId),
  ]);

  // Aggregate sessions count per client
  const sessionCounts: Record<string, number> = {};
  for (const a of appts ?? []) {
    sessionCounts[a.client_id] = (sessionCounts[a.client_id] ?? 0) + 1;
  }

  // Aggregate total spent per client
  const spentTotals: Record<string, number> = {};
  for (const inv of invoices ?? []) {
    spentTotals[inv.client_id] =
      (spentTotals[inv.client_id] ?? 0) + (inv.amount ?? 0);
  }

  const clientsWithStats: ClientListItem[] = (clients ?? []).map((c) => ({
    ...c,
    sessions: sessionCounts[c.id] ?? 0,
    totalSpent: spentTotals[c.id] ?? 0,
  }));

  return <ContactsView clients={clientsWithStats} />;
}
