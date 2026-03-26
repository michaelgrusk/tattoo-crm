import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { WaiverSignForm } from "@/components/waiver-sign-form";
import type { WaiverTemplate } from "@/app/(app)/waivers/types";

// Public page — no auth required.
// Fetches template + studio info using anon key (same as the public client).

export default async function PublicWaiverSignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsedId = parseInt(id);
  if (isNaN(parsedId)) notFound();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: template, error } = await supabase
    .from("waiver_templates")
    .select("*")
    .eq("id", parsedId)
    .eq("is_active", true)
    .single();

  if (error || !template) notFound();

  // Get studio name from profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("studio_name")
    .eq("id", template.user_id)
    .single();

  const studioName = profile?.studio_name ?? "Your Studio";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-5">
        <div className="max-w-xl mx-auto">
          <p className="text-xs font-semibold text-violet-600 uppercase tracking-wider mb-1">
            {studioName}
          </p>
          <h1 className="text-xl font-semibold text-gray-900">{template.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Please read and complete this consent form before your appointment.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
          <WaiverSignForm
            template={template as WaiverTemplate}
            userId={template.user_id}
          />
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by{" "}
          <span className="font-semibold text-violet-500">Needlebook</span>
        </p>
      </div>
    </div>
  );
}
