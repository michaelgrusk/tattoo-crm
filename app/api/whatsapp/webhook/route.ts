import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── GET — Meta webhook verification ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("[whatsapp/webhook] Verified");
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// ── POST — Process incoming webhook events ────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const entries = body?.entry ?? [];

    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;
        if (!value) continue;

        // ── Message status updates (sent → delivered → read / failed) ──────
        for (const status of value?.statuses ?? []) {
          const waMessageId = status?.id;
          const newStatus = status?.status; // sent, delivered, read, failed

          if (waMessageId && newStatus) {
            await supabaseAdmin
              .from("whatsapp_messages")
              .update({
                status: newStatus,
                status_updated_at: new Date().toISOString(),
              })
              .eq("whatsapp_message_id", waMessageId);
          }
        }

        // ── Inbound messages ────────────────────────────────────────────────
        for (const msg of value?.messages ?? []) {
          const from = msg?.from; // phone number
          const msgId = msg?.id;
          const text = msg?.text?.body ?? msg?.type ?? "";

          // Try to find the client by phone number
          const { data: client } = await supabaseAdmin
            .from("clients")
            .select("id, user_id")
            .ilike("phone", `%${from.slice(-10)}%`)
            .maybeSingle();

          if (client) {
            await supabaseAdmin.from("whatsapp_messages").insert({
              user_id: client.user_id,
              client_id: client.id,
              direction: "inbound",
              message_text: text,
              whatsapp_message_id: msgId,
              status: "delivered",
              status_updated_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[whatsapp/webhook]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
