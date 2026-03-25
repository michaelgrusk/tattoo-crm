import { supabase } from "@/lib/supabase";
import { InvoicesView } from "./_components/invoices-view";

export type Invoice = {
  id: string;
  created_at: string;
  client_id: string;
  amount: number;
  status: "paid" | "pending" | "deposit";
  type: string;
  date: string;
  clients: { name: string; email: string } | null;
};

export type InvoiceSummary = {
  totalThisMonth: number;
  outstanding: number;
  depositsHeld: number;
};

export default async function InvoicesPage() {
  const { data } = await supabase
    .from("invoices")
    .select("*, clients(name, email)")
    .order("date", { ascending: false });

  const invoices = (data as Invoice[]) ?? [];

  // Summary card values
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const totalThisMonth = invoices
    .filter((inv) => {
      const d = new Date(inv.date);
      return (
        inv.status === "paid" &&
        d.getMonth() === thisMonth &&
        d.getFullYear() === thisYear
      );
    })
    .reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

  const outstanding = invoices
    .filter((inv) => inv.status === "pending")
    .reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

  const depositsHeld = invoices
    .filter((inv) => inv.status === "deposit")
    .reduce((sum, inv) => sum + (inv.amount ?? 0), 0);

  return (
    <InvoicesView
      invoices={invoices}
      summary={{ totalThisMonth, outstanding, depositsHeld }}
    />
  );
}
