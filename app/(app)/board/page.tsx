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
  status: "new request" | "quote sent" | "deposit paid" | "declined";
  reference_image_url: string | null;
  quote_amount: number | null;
};

export type Appointment = {
  id: string;
  created_at: string;
  client_id: string;
  artist_name: string;
  date: string;
  time: string;
  type: string;
  status: string;
  clients: { name: string } | null;
};

export default async function BoardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
  const today = new Date().toISOString().split("T")[0];

  const [{ data: requests }, { data: appointments }] = await Promise.all([
    supabase
      .from("tattoo_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("*, clients(name)")
      .eq("user_id", userId)
      .gte("date", today)
      .order("date", { ascending: true })
      .order("time", { ascending: true })
      .limit(20),
  ]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Board</h1>
        <p className="mt-1 text-sm text-gray-500">
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
