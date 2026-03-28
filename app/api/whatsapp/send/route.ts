import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phoneNumber, templateName, variables, clientId, relatedType, relatedId } = body;

    if (!phoneNumber || !templateName) {
      return NextResponse.json({ error: "phoneNumber and templateName are required" }, { status: 400 });
    }

    // Get the auth token from the Authorization header
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve user from token
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Resolve phone number ID and access token ──────────────────────────────
    // Test mode: use env vars directly if present (no whatsapp_connections record needed)
    const envPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const envAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    let phoneNumberId: string;
    let accessToken: string;

    if (envPhoneNumberId && envAccessToken && envAccessToken !== "placeholder") {
      // Use env var credentials (test / dev mode)
      phoneNumberId = envPhoneNumberId;
      accessToken = envAccessToken;
    } else {
      // Production: fetch the studio's WhatsApp connection record
      const { data: conn } = await supabaseAdmin
        .from("whatsapp_connections")
        .select("phone_number_id, access_token, is_connected")
        .eq("user_id", user.id)
        .single();

      if (!conn?.is_connected) {
        return NextResponse.json({ error: "WhatsApp not connected" }, { status: 400 });
      }

      phoneNumberId = conn.phone_number_id;
      accessToken = conn.access_token;
    }

    // Normalise phone: strip everything except digits, remove leading +
    const normalisedPhone = phoneNumber.replace(/\D/g, "").replace(/^0+/, "");

    // TODO: swap back to `templateName` once Meta approves custom templates.
    // For now use the only approved template "hello_world" for connection testing.
    const metaTemplateName = "hello_world";
    const metaLanguageCode = "en_US";

    // Build the Meta Cloud API payload
    const messagePayload = {
      messaging_product: "whatsapp",
      to: normalisedPhone,
      type: "template",
      template: {
        name: metaTemplateName,
        language: { code: metaLanguageCode },
        // hello_world has no body parameters — omit components entirely
        components: [],
      },
    };

    const metaRes = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      }
    );

    const metaJson = await metaRes.json();
    const whatsappMessageId = metaJson?.messages?.[0]?.id ?? null;

    if (!metaRes.ok) {
      // Log failed message
      await supabaseAdmin.from("whatsapp_messages").insert({
        user_id: user.id,
        client_id: clientId ?? null,
        direction: "outbound",
        template_name: templateName,
        message_text: JSON.stringify(variables),
        status: "failed",
        related_type: relatedType ?? null,
        related_id: relatedId ?? null,
        status_updated_at: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: metaJson?.error?.message ?? "Meta API error" },
        { status: 502 }
      );
    }

    // Log sent message
    await supabaseAdmin.from("whatsapp_messages").insert({
      user_id: user.id,
      client_id: clientId ?? null,
      direction: "outbound",
      template_name: templateName,
      message_text: JSON.stringify(variables),
      whatsapp_message_id: whatsappMessageId,
      status: "sent",
      related_type: relatedType ?? null,
      related_id: relatedId ?? null,
      status_updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, messageId: whatsappMessageId });
  } catch (err) {
    console.error("[whatsapp/send]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
