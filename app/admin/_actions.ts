"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const ADMIN_EMAIL = "saltedslightly@gmail.com";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://needlebook-crm.vercel.app";

async function assertAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.email !== ADMIN_EMAIL) throw new Error("Unauthorized");
  return user;
}

export type AdminProfile = {
  id: string;
  email: string;
  studio_name: string | null;
  approval_status: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

export async function fetchAllProfiles(): Promise<AdminProfile[]> {
  await assertAdmin();
  const admin = getSupabaseAdmin();

  // Fetch both auth users and profile rows in parallel
  const [{ data: profiles }, { data: { users } }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, studio_name, approval_status, approved_at, rejected_at, rejection_reason, created_at"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Build merged list — auth users without a profile row show as pending
  return users
    .filter((u) => u.email !== ADMIN_EMAIL) // exclude admin from the list
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((user) => {
      const profile = profileMap.get(user.id);
      return {
        id: user.id,
        email: user.email ?? "",
        studio_name:
          profile?.studio_name ??
          (user.user_metadata?.studio_name as string | null) ??
          null,
        approval_status: profile?.approval_status ?? "pending",
        approved_at: profile?.approved_at ?? null,
        rejected_at: profile?.rejected_at ?? null,
        rejection_reason: profile?.rejection_reason ?? null,
        created_at: profile?.created_at ?? user.created_at,
      };
    });
}

export async function approveUser(
  userId: string,
  userEmail: string,
  studioName: string
): Promise<{ error?: string }> {
  await assertAdmin();
  const admin = getSupabaseAdmin();

  // Upsert so it works whether or not a profile row exists yet
  const { error } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        studio_name: studioName || null,
        approval_status: "approved",
        approved_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) return { error: error.message };

  // Send approval email via Resend
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const fromAddress = process.env.RESEND_FROM ?? "onboarding@resend.dev";
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: `Needlebook <${fromAddress}>`,
        to: [userEmail],
        subject: "Your Needlebook account has been approved! 🎉",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
            <h2 style="color:#7C3AED;margin-bottom:8px">Welcome to Needlebook!</h2>
            <p>Hi ${studioName || "there"},</p>
            <p>Great news — your Needlebook account has been approved and is ready to use.</p>
            <p style="margin-top:24px">
              <a href="${SITE_URL}/login"
                 style="display:inline-block;background:#7C3AED;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600">
                Get started →
              </a>
            </p>
            <p style="margin-top:24px;color:#888;font-size:13px">
              If you have any questions, reply to this email.
            </p>
          </div>
        `,
      }),
    });
  }

  return {};
}

export async function rejectUser(
  userId: string,
  reason: string
): Promise<{ error?: string }> {
  await assertAdmin();
  const admin = getSupabaseAdmin();

  // Upsert so it works whether or not a profile row exists yet
  const { error } = await admin
    .from("profiles")
    .upsert(
      {
        id: userId,
        approval_status: "rejected",
        rejected_at: new Date().toISOString(),
        rejection_reason: reason.trim() || null,
      },
      { onConflict: "id" }
    );

  if (error) return { error: error.message };
  return {};
}
