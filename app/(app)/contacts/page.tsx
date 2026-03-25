import { supabase } from "@/lib/supabase";
import { ContactsView } from "./_components/contacts-view";

export type ClientListItem = {
  id: string | number;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  notes: string | null;
  skin_notes: string | null;
  sessions: number;
  totalSpent: number;
};

export default async function ContactsPage() {
  const [
    { data: clients },
    { data: appts },
    { data: invoices },
  ] = await Promise.all([
    supabase.from("clients").select("*").order("name"),
    supabase.from("appointments").select("client_id"),
    supabase.from("invoices").select("client_id, amount"),
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
