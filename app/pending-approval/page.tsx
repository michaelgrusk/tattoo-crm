import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Clock } from "lucide-react";
import Image from "next/image";
import { SignOutButton } from "./sign-out-button";

export const metadata = { title: "Under Review — Tatflow" };

export default async function PendingApprovalPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  let studioName: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("studio_name")
      .eq("id", user.id)
      .single();
    studioName = data?.studio_name ?? null;
  }

  return (
    <div className="min-h-screen bg-[var(--nb-bg)] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm bg-[var(--nb-card)] rounded-2xl border border-[var(--nb-border)] shadow-sm px-8 py-8 text-center">
        <div className="flex justify-center mb-5">
          <Image
            src="/logo.png"
            alt="Tatflow"
            width={200}
            height={200}
            style={{ height: "70px", width: "auto" }}
            priority
          />
        </div>

        <div className="size-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
          <Clock size={22} className="text-amber-600" />
        </div>

        <h1 className="text-lg font-semibold text-[var(--nb-text)] mb-2">
          Your account is under review
        </h1>

        {studioName && (
          <p className="text-sm font-medium text-[#7C3AED] mb-3">{studioName}</p>
        )}

        <p className="text-sm text-[var(--nb-text-2)] leading-relaxed mb-7">
          We&apos;re reviewing your application. You&apos;ll receive an email once approved — usually within 24 hours.
        </p>

        <SignOutButton />
      </div>

      <p className="mt-6 text-xs text-[var(--nb-text-2)]">© {new Date().getFullYear()} Tatflow</p>
    </div>
  );
}
