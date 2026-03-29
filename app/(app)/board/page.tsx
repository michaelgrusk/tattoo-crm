import { createSupabaseServerClient } from "@/lib/supabase/server";
import { IntakeQueue } from "./_components/intake-queue";
import { UpcomingAppointments } from "./_components/upcoming-appointments";

export type TattooRequest = {
  id: string;
  created_at: string;
  client_id: string | null;
  client_name: string;
  client_email: string;
  description: string;
  style: string;
  status: "new request" | "quote sent" | "deposit paid" | "declined" | "archived";
  reference_image_url: string | null;
  quote_amount: number | null;
  artist_id: number | null;
  whatsapp_opt_in: boolean;
};

export type Appointment = {
  id: string;
  created_at: string;
  client_id: string;
  artist_name: string;
  artist_id: number | null;
  date: string;
  time: string;
  type: string;
  status: string;
  clients: { name: string } | null;
  artists: { name: string } | null;
};

export default async function BoardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  const today = new Date().toISOString().split("T")[0];

  const [{ data: requests }, { data: rawAppointments }] = await Promise.all([
    supabase
      .from("tattoo_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("*, clients(name, id), artists(name)")
      .eq("user_id", userId)
      .gte("date", today)
      .order("date", { ascending: true })
      .order("time", { ascending: true })
      .limit(20),
  ]);

  const appointments = (rawAppointments ?? []).filter(
    (a: { client_id: string; clients?: { id: string } | null }) =>
      a.clients != null
  );

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--nb-text)]">Board</h1>
        <p className="mt-1 text-sm text-[var(--nb-text-2)]">
          Manage incoming requests and upcoming appointments
        </p>
      </div>

      <IntakeQueue requests={(requests as TattooRequest[]) ?? []} />

      <UpcomingAppointments
        appointments={(appointments as Appointment[]) ?? []}
      />
    </div>
  );
}
