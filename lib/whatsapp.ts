/**
 * WhatsApp Business API — Needlebook
 * Calls app/api/whatsapp/send which handles the Meta API server-side.
 */
import { supabase } from "@/lib/supabase/client";

export type WhatsAppTemplate =
  | "quote"
  | "deposit_followup"
  | "reminder"
  | "aftercare";

export type SendWhatsAppParams = {
  phoneNumber: string;
  templateName: WhatsAppTemplate;
  variables: Record<string, string>;
  clientId?: string | number;
  relatedType?: string;
  relatedId?: string | number;
};

export type SendWhatsAppResult =
  | { success: true; messageId: string }
  | { success: false; error: string };

export async function sendWhatsAppTemplate(
  params: SendWhatsAppParams
): Promise<SendWhatsAppResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";
    const res = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
    const json = await res.json();
    if (!res.ok) return { success: false, error: json.error ?? "Unknown error" };
    return { success: true, messageId: json.messageId };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ── Default template bodies ────────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: Record<
  WhatsAppTemplate,
  { label: string; category: string; body: string; variables: string[] }
> = {
  quote: {
    label: "Quote",
    category: "quote",
    body: "Hi {{client_name}}! 🖋️ Thanks for reaching out to {{studio_name}}.\n\nWe'd love to work on your {{style}} tattoo. Here's our quote:\n\n💰 *{{amount}}*\n\nReply *YES* to move forward or ask any questions. We're excited to work with you!",
    variables: ["client_name", "studio_name", "style", "amount"],
  },
  deposit_followup: {
    label: "Deposit Follow-up",
    category: "deposit_followup",
    body: "Hi {{client_name}}! Just a reminder that your deposit of *{{amount}}* is due to secure your appointment on {{date}}.\n\nReply here or contact us to arrange payment. We look forward to seeing you! 🖤",
    variables: ["client_name", "amount", "date"],
  },
  reminder: {
    label: "Appointment Reminder",
    category: "reminder",
    body: "Hi {{client_name}}! 👋 Reminder for your upcoming tattoo appointment at {{studio_name}}:\n\n📅 *{{date}}* at *{{time}}*\n\nPlease arrive 10 minutes early. See you soon! 🖋️",
    variables: ["client_name", "studio_name", "date", "time"],
  },
  aftercare: {
    label: "Aftercare",
    category: "aftercare",
    body: "Hi {{client_name}}! Your new tattoo looks incredible 🖤\n\nAftercare tips:\n• Wash gently with unscented soap\n• Apply thin unscented moisturiser 2–3× daily\n• Avoid sunlight, swimming, and soaking for 2 weeks\n• Don't pick or scratch — let it peel naturally\n\nAny questions? Reply here anytime! 🙏",
    variables: ["client_name"],
  },
};
