import { inngest } from "./client";
import { resend } from "@/lib/resend";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const EVENT = "needlebook/appointment.scheduled";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function apptDatetime(date: string, time: string): Date {
  // date = YYYY-MM-DD, time = HH:MM or HH:MM:SS
  return new Date(`${date}T${time}`);
}

function formatDate(date: string, time: string): string {
  const dt = new Date(`${date}T${time}`);
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Returns false if the appointment has been cancelled or deleted. */
async function appointmentIsActive(id: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from("appointments")
    .select("status")
    .eq("id", id)
    .single();
  return !!data && data.status !== "cancelled";
}

// ─── Shared email chrome ───────────────────────────────────────────────────────

function emailShell(studioName: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#F8F7FF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7FF;padding:40px 16px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:24px">
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
                    ${studioName}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#FFFFFF;border-radius:16px;border:1px solid #E4E2F0;padding:36px 36px 32px">
              <div style="height:3px;background:linear-gradient(90deg,#7C3AED,#A78BFA);border-radius:4px;margin-bottom:28px"></div>
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:20px">
              <p style="margin:0;font-size:12px;color:#9490A8">
                Sent by <span style="color:#7C3AED;font-weight:500">Needlebook</span> on behalf of ${studioName}
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

function heading(text: string): string {
  return `<p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1A1625;letter-spacing:-0.3px">${text}</p>`;
}

function subtext(text: string): string {
  return `<p style="margin:0 0 24px;font-size:14px;color:#6B6880;line-height:1.6">${text}</p>`;
}

function apptBox(date: string, time: string, type: string): string {
  return `
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#F8F7FF;border-radius:10px;border:1px solid #E4E2F0;margin-bottom:24px">
      <tr>
        <td style="padding:16px 20px">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#9490A8;text-transform:uppercase;letter-spacing:0.08em">Your Appointment</p>
          <p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#1A1625">${formatDate(date, time)}</p>
          <p style="margin:0;font-size:13px;color:#6B6880">${formatTime(time)} · ${type}</p>
        </td>
      </tr>
    </table>`;
}

function listItem(emoji: string, text: string): string {
  return `<tr><td style="padding:5px 0;font-size:13px;color:#1A1625;vertical-align:top;width:28px">${emoji}</td><td style="padding:5px 0;font-size:13px;color:#1A1625;line-height:1.5">${text}</td></tr>`;
}

// ─── 1. 24-hour reminder ───────────────────────────────────────────────────────

export const reminder24h = inngest.createFunction(
  { id: "appointment-24h-reminder", name: "Appointment: 24-hour reminder", triggers: [{ event: EVENT }] },
  async ({ event, step }) => {
    const { appointment_id, client_name, client_email, appointment_date, appointment_time, appointment_type, studio_name } = event.data;

    const apptDt = apptDatetime(appointment_date, appointment_time);
    const sendAt = new Date(apptDt.getTime() - 24 * 60 * 60 * 1000);

    if (sendAt <= new Date()) {
      return { skipped: "appointment is less than 24 hours away" };
    }

    await step.sleepUntil("wait-until-24h-before", sendAt);

    const active = await step.run("check-appointment", () =>
      appointmentIsActive(appointment_id)
    );
    if (!active) return { skipped: "appointment cancelled" };

    await step.run("send-24h-reminder", async () => {
      const html = emailShell(studio_name, `
        ${heading(`See you tomorrow, ${client_name}! 👋`)}
        ${subtext("Your tattoo appointment is in 24 hours. Here's a quick reminder of the details:")}
        ${apptBox(appointment_date, appointment_time, appointment_type)}
        <p style="margin:0 0 12px;font-size:11px;font-weight:600;color:#9490A8;text-transform:uppercase;letter-spacing:0.08em">Before You Arrive</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:0">
          ${listItem("🍽️", "Eat a full meal beforehand — your blood sugar should be stable.")}
          ${listItem("💧", "Drink plenty of water today and the morning of your appointment.")}
          ${listItem("🧴", "Moisturise the area to be tattooed (but skip lotions on the day).")}
          ${listItem("🕐", "Arrive on time or a few minutes early.")}
          ${listItem("👕", "Wear comfortable clothing that gives easy access to the tattoo area.")}
        </table>
      `);

      await resend.emails.send({
        from: "Needlebook <onboarding@resend.dev>",
        to: client_email,
        subject: `Reminder: Your appointment tomorrow at ${studio_name}`,
        html,
      });
    });

    return { sent: true };
  }
);

// ─── 2. 1-week prep instructions ──────────────────────────────────────────────

export const reminder1Week = inngest.createFunction(
  { id: "appointment-1week-prep", name: "Appointment: 1-week prep instructions", triggers: [{ event: EVENT }] },
  async ({ event, step }) => {
    const { appointment_id, client_name, client_email, appointment_date, appointment_time, appointment_type, studio_name } = event.data;

    const apptDt = apptDatetime(appointment_date, appointment_time);
    const sendAt = new Date(apptDt.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (sendAt <= new Date()) {
      return { skipped: "appointment is less than 1 week away" };
    }

    await step.sleepUntil("wait-until-1week-before", sendAt);

    const active = await step.run("check-appointment", () =>
      appointmentIsActive(appointment_id)
    );
    if (!active) return { skipped: "appointment cancelled" };

    await step.run("send-1week-prep", async () => {
      const html = emailShell(studio_name, `
        ${heading(`Your appointment is one week away! 🎉`)}
        ${subtext(`Hey ${client_name}, your ${appointment_type.toLowerCase()} at ${studio_name} is coming up in 7 days. Here's how to prepare so you get the best results:`)}
        ${apptBox(appointment_date, appointment_time, appointment_type)}
        <p style="margin:0 0 12px;font-size:11px;font-weight:600;color:#9490A8;text-transform:uppercase;letter-spacing:0.08em">How to Prepare</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
          ${listItem("🧴", "<strong>Moisturise daily</strong> — hydrated skin takes ink better and heals faster.")}
          ${listItem("☀️", "<strong>Avoid sun exposure</strong> on the area — sunburnt skin cannot be tattooed.")}
          ${listItem("🚫", "<strong>No alcohol</strong> 24 hours before — it thins the blood and affects healing.")}
          ${listItem("💊", "<strong>Avoid blood thinners</strong> (aspirin, ibuprofen) unless medically required.")}
          ${listItem("😴", "<strong>Get a good night's sleep</strong> the night before — rested skin heals better.")}
          ${listItem("🍽️", "<strong>Eat well</strong> — have a substantial meal before you come in.")}
        </table>
        <p style="margin:0;font-size:13px;color:#6B6880;line-height:1.6">
          If you have any questions or need to reschedule, please get in touch as soon as possible. We look forward to seeing you!
        </p>
      `);

      await resend.emails.send({
        from: "Needlebook <onboarding@resend.dev>",
        to: client_email,
        subject: `Your appointment at ${studio_name} is one week away`,
        html,
      });
    });

    return { sent: true };
  }
);

// ─── 3. Aftercare follow-up ────────────────────────────────────────────────────

export const aftercareFollowUp = inngest.createFunction(
  { id: "appointment-aftercare-followup", name: "Appointment: aftercare follow-up", triggers: [{ event: EVENT }] },
  async ({ event, step }) => {
    const { appointment_id, client_name, client_email, appointment_date, appointment_time, appointment_type, studio_name } = event.data;

    const apptDt = apptDatetime(appointment_date, appointment_time);
    // Send the morning after the appointment (same time next day)
    const sendAt = new Date(apptDt.getTime() + 24 * 60 * 60 * 1000);

    await step.sleepUntil("wait-until-next-day", sendAt);

    // Only send aftercare if the appointment wasn't cancelled
    const active = await step.run("check-appointment", () =>
      appointmentIsActive(appointment_id)
    );
    if (!active) return { skipped: "appointment cancelled" };

    await step.run("send-aftercare-followup", async () => {
      const html = emailShell(studio_name, `
        ${heading(`How's the new ink, ${client_name}? 🖤`)}
        ${subtext(`Thanks for coming in! Your fresh tattoo needs a little extra love for the next few weeks. Follow these aftercare steps to keep it looking its best:`)}
        <p style="margin:0 0 12px;font-size:11px;font-weight:600;color:#9490A8;text-transform:uppercase;letter-spacing:0.08em">First 24–48 Hours</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
          ${listItem("🩹", "Leave the wrap/bandage on for the time your artist specified.")}
          ${listItem("🧼", "Wash gently with unscented soap and lukewarm water — pat dry.")}
          ${listItem("🚫", "Do not re-wrap unless specifically instructed.")}
          ${listItem("💧", "Apply a thin layer of unscented moisturiser 2–3 times a day.")}
        </table>
        <p style="margin:0 0 12px;font-size:11px;font-weight:600;color:#9490A8;text-transform:uppercase;letter-spacing:0.08em">The Next 2–4 Weeks</p>
        <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px">
          ${listItem("☀️", "<strong>No direct sun</strong> — use SPF 50+ once healed to protect colour.")}
          ${listItem("🏊", "<strong>No swimming, saunas, or soaking</strong> — showers only until fully healed.")}
          ${listItem("🙅", "<strong>Don't pick or scratch</strong> — let flaking skin shed naturally.")}
          ${listItem("👕", "Wear loose, breathable clothing over the tattooed area.")}
        </table>
        <p style="margin:0;font-size:13px;color:#6B6880;line-height:1.6">
          If you notice excessive redness, swelling, or any signs of infection — please contact your artist or a medical professional promptly. Questions? Just reply to this email.
        </p>
      `);

      await resend.emails.send({
        from: "Needlebook <onboarding@resend.dev>",
        to: client_email,
        subject: `Your aftercare guide from ${studio_name}`,
        html,
      });
    });

    return { sent: true };
  }
);

// ─── 4. 6-month rebooking nudge ────────────────────────────────────────────────

export const rebookingNudge = inngest.createFunction(
  { id: "appointment-rebook-nudge", name: "Appointment: 6-month rebooking nudge", triggers: [{ event: EVENT }] },
  async ({ event, step }) => {
    const { appointment_id, client_name, client_email, appointment_date, appointment_time, appointment_type, studio_name, user_id } = event.data;

    const apptDt = apptDatetime(appointment_date, appointment_time);
    // 6 months after the appointment
    const sendAt = new Date(apptDt);
    sendAt.setMonth(sendAt.getMonth() + 6);

    await step.sleepUntil("wait-until-6-months", sendAt);

    // Check the appointment was not cancelled (verify the original session happened)
    const active = await step.run("check-appointment", () =>
      appointmentIsActive(appointment_id)
    );
    if (!active) return { skipped: "appointment cancelled" };

    // Check if the client has had another appointment in the last 2 months
    // If so, skip the nudge — they're already returning
    const hasRecentAppt = await step.run("check-recent-appointments", async () => {
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      const { data } = await getSupabaseAdmin()
        .from("appointments")
        .select("id")
        .eq("user_id", user_id)
        .gte("date", twoMonthsAgo.toISOString().split("T")[0])
        .neq("id", appointment_id)
        .limit(1);
      return (data?.length ?? 0) > 0;
    });

    if (hasRecentAppt) {
      return { skipped: "client has recent appointment — skipping nudge" };
    }

    await step.run("send-rebook-nudge", async () => {
      // Fetch the studio's intake slug so we can link to the intake form
      const { data: profile } = await getSupabaseAdmin()
        .from("profiles")
        .select("slug")
        .eq("id", user_id)
        .single();

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const intakeUrl = profile?.slug
        ? `${siteUrl}/intake/${profile.slug}`
        : siteUrl;

      const html = emailShell(studio_name, `
        ${heading(`Time for some new ink, ${client_name}? ✨`)}
        ${subtext(`It's been about 6 months since your ${appointment_type.toLowerCase()} at ${studio_name}! We'd love to have you back in the chair.`)}
        <div style="background:#F8F7FF;border-radius:10px;border:1px solid #E4E2F0;padding:20px 24px;margin-bottom:28px">
          <p style="margin:0 0 8px;font-size:14px;color:#1A1625;font-weight:600">Ideas for your next session?</p>
          <table cellpadding="0" cellspacing="0" style="width:100%">
            ${listItem("🔲", "A matching companion piece")}
            ${listItem("🌿", "Fill in or extend an existing tattoo")}
            ${listItem("🎨", "Something completely new")}
            ${listItem("✨", "Touch up older work")}
          </table>
        </div>
        <table cellpadding="0" cellspacing="0" style="width:100%">
          <tr>
            <td align="center">
              <a href="${intakeUrl}"
                 style="display:inline-block;background:#7C3AED;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;padding:12px 28px;letter-spacing:-0.1px">
                Book Your Next Session →
              </a>
            </td>
          </tr>
        </table>
      `);

      await resend.emails.send({
        from: "Needlebook <onboarding@resend.dev>",
        to: client_email,
        subject: `Ready for your next tattoo? 🖤 ${studio_name} would love to see you`,
        html,
      });
    });

    return { sent: true };
  }
);

// ─── Exports ───────────────────────────────────────────────────────────────────

export const functions = [reminder24h, reminder1Week, aftercareFollowUp, rebookingNudge];
