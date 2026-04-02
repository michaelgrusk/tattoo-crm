import { NextRequest, NextResponse } from "next/server";
import { resend } from "@/lib/resend";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { analyzeBrief } from "@/lib/ai/analyze-brief";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      user_id,
      request_id,
      studio_name,
      client_name,
      client_email,
      client_phone,
      client_instagram,
      description,
      style,
      placement,
      size,
      preferred_date,
    } = body as {
      user_id: string;
      request_id: string | null;
      studio_name: string;
      client_name: string;
      client_email: string;
      client_phone?: string;
      client_instagram?: string;
      description: string;
      style: string;
      placement: string;
      size: string;
      preferred_date: string;
    };

    // Look up the artist's email via the admin client (created lazily at request time)
    const { data: userData, error: userError } =
      await getSupabaseAdmin().auth.admin.getUserById(user_id);

    if (userError || !userData.user?.email) {
      console.error("[notify-intake] Failed to fetch artist email:", userError);
      return NextResponse.json({ error: "Artist email not found" }, { status: 500 });
    }

    const artistEmail = userData.user.email;
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const formattedDate = preferred_date
      ? new Date(preferred_date + "T00:00:00").toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : null;

    const html = buildEmail({
      studioName: studio_name,
      clientName: client_name,
      clientEmail: client_email,
      description,
      style,
      placement,
      size,
      formattedDate,
      boardUrl: `${appUrl}/board`,
    });

    const { error: sendError } = await resend.emails.send({
      from: "Needlebook <onboarding@resend.dev>",
      to: artistEmail,
      subject: `New tattoo request from ${client_name}`,
      html,
    });

    if (sendError) {
      console.error("[notify-intake] Resend error:", sendError);
      return NextResponse.json({ error: sendError.message }, { status: 500 });
    }

    // Auto-create a client record for this lead (if one doesn't already exist)
    if (client_email && request_id) {
      const admin = getSupabaseAdmin();

      const { data: existing } = await admin
        .from("clients")
        .select("id")
        .eq("user_id", user_id)
        .eq("email", client_email.toLowerCase())
        .maybeSingle();

      let clientId: string | null = existing?.id ?? null;

      if (!clientId) {
        const { data: newClient } = await admin
          .from("clients")
          .insert({
            user_id,
            name: client_name,
            email: client_email,
            phone: client_phone || null,
            instagram: client_instagram || null,
            status: "new_lead",
          })
          .select("id")
          .single();
        clientId = newClient?.id ?? null;
      }

      if (clientId) {
        await admin
          .from("tattoo_requests")
          .update({ client_id: clientId })
          .eq("id", request_id);
      }

      // Auto-analyze the brief if the profile has ai_auto_analyze enabled (default true)
      try {
        const { data: profile } = await admin
          .from("profiles")
          .select("ai_auto_analyze")
          .eq("id", user_id)
          .single();

        const shouldAnalyze = profile?.ai_auto_analyze !== false;

        if (shouldAnalyze) {
          const { data: artists } = await admin
            .from("artists")
            .select("name")
            .eq("user_id", user_id)
            .eq("is_active", true)
            .order("name");

          const analysis = analyzeBrief({
            client_name,
            description,
            style,
            placement,
            size,
            preferred_date,
            has_reference_image: false,
            has_phone: !!client_phone,
            has_instagram: !!client_instagram,
            artists: (artists as { name: string }[]) ?? [],
          });

          await admin
            .from("tattoo_requests")
            .update({
              ai_analysis: analysis,
              ai_analyzed_at: new Date().toISOString(),
            })
            .eq("id", request_id);
        }
      } catch (aiErr) {
        // Non-fatal: log but don't fail the intake
        console.error("[notify-intake] AI analysis failed:", aiErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notify-intake] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── Email HTML ───────────────────────────────────────────────────────────────

function row(label: string, value: string | null | undefined) {
  if (!value) return "";
  return `
    <tr>
      <td style="padding:6px 0;color:#6B6880;font-size:13px;white-space:nowrap;vertical-align:top;width:130px">${label}</td>
      <td style="padding:6px 0;color:#1A1625;font-size:13px;font-weight:500">${value}</td>
    </tr>`;
}

function buildEmail({
  studioName,
  clientName,
  clientEmail,
  description,
  style,
  placement,
  size,
  formattedDate,
  boardUrl,
}: {
  studioName: string;
  clientName: string;
  clientEmail: string;
  description: string;
  style: string;
  placement: string;
  size: string;
  formattedDate: string | null;
  boardUrl: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New tattoo request from ${clientName}</title>
</head>
<body style="margin:0;padding:0;background:#F8F7FF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF;padding:40px 16px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:28px">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#7C3AED;border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle">
                    <span style="display:inline-block;line-height:36px">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">
                        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                    </span>
                  </td>
                  <td style="padding-left:10px;color:#7C3AED;font-size:16px;font-weight:700;letter-spacing:-0.3px;vertical-align:middle">
                    Needlebook
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#FFFFFF;border-radius:16px;border:1px solid #E4E2F0;padding:36px 36px 32px">

              <!-- Heading -->
              <p style="margin:0 0 6px;font-size:20px;font-weight:700;color:#1A1625;letter-spacing:-0.3px">
                You have a new request${studioName ? ` for ${studioName}` : ""}
              </p>
              <p style="margin:0 0 28px;font-size:14px;color:#6B6880">
                ${clientName} submitted a tattoo request via your intake form.
              </p>

              <!-- Purple divider -->
              <div style="height:3px;background:linear-gradient(90deg,#7C3AED,#A78BFA);border-radius:4px;margin-bottom:24px"></div>

              <!-- Client section -->
              <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#9490A8;text-transform:uppercase;letter-spacing:0.08em">
                Client
              </p>
              <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
                ${row("Name", clientName)}
                ${row("Email", clientEmail)}
              </table>

              <!-- Tattoo details section -->
              <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#9490A8;text-transform:uppercase;letter-spacing:0.08em">
                Tattoo Details
              </p>
              <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
                ${row("Style", style)}
                ${row("Placement", placement)}
                ${row("Size", size)}
                ${row("Preferred date", formattedDate)}
              </table>

              <!-- Description -->
              <p style="margin:0 0 10px;font-size:11px;font-weight:600;color:#9490A8;text-transform:uppercase;letter-spacing:0.08em">
                Description
              </p>
              <div style="background:#F8F7FF;border-radius:10px;border:1px solid #E4E2F0;padding:14px 16px;margin-bottom:28px">
                <p style="margin:0;font-size:14px;color:#1A1625;line-height:1.6;white-space:pre-wrap">${description}</p>
              </div>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="width:100%">
                <tr>
                  <td align="center">
                    <a href="${boardUrl}"
                       style="display:inline-block;background:#7C3AED;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;padding:12px 28px;letter-spacing:-0.1px">
                      View Request on Board →
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:20px">
              <p style="margin:0;font-size:12px;color:#9490A8">
                Sent by <a href="${boardUrl}" style="color:#7C3AED;text-decoration:none;font-weight:500">Needlebook</a> · You're receiving this because a client submitted your intake form.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
