/**
 * POST /api/paddle/webhook
 *
 * Handles Paddle webhook events. Signature is verified with PADDLE_WEBHOOK_SECRET.
 *
 * To set up:
 *   1. Go to Paddle Dashboard → Notifications → New notification
 *   2. Set endpoint URL to: https://your-domain.com/api/paddle/webhook
 *   3. Subscribe to: transaction.completed, transaction.paid
 *   4. Copy the secret key and set PADDLE_WEBHOOK_SECRET in .env.local
 */
import { NextResponse, type NextRequest } from "next/server";
import { getPaddle } from "@/lib/paddle/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { EventName } from "@paddle/paddle-node-sdk";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("paddle-signature") ?? "";
  const secret = process.env.PADDLE_WEBHOOK_SECRET ?? "";

  if (!secret) {
    console.error("[paddle/webhook] PADDLE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event;
  try {
    const paddle = getPaddle();
    event = await paddle.webhooks.unmarshal(rawBody, secret, signature);
  } catch (err) {
    console.error("[paddle/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    if (
      event.eventType === EventName.TransactionCompleted ||
      event.eventType === EventName.TransactionPaid
    ) {
      const transaction = event.data;
      const paddleTransactionId = transaction.id;
      const customData = transaction.customData as Record<string, unknown> | null;

      const admin = getSupabaseAdmin();

      // Look up the invoice by paddle_transaction_id
      const { data: invoice, error: lookupError } = await admin
        .from("invoices")
        .select("id, user_id, appointment_id")
        .eq("paddle_transaction_id", paddleTransactionId)
        .single();

      if (lookupError || !invoice) {
        console.warn(
          "[paddle/webhook] No matching invoice for transaction:",
          paddleTransactionId
        );
        // Return 200 so Paddle doesn't retry — this may be a non-deposit transaction
        return NextResponse.json({ received: true });
      }

      // Update invoice status to "deposit" (paid)
      const { error: updateError } = await admin
        .from("invoices")
        .update({ status: "deposit" })
        .eq("id", invoice.id);

      if (updateError) {
        console.error("[paddle/webhook] Failed to update invoice:", updateError.message);
        return NextResponse.json({ error: "DB update failed" }, { status: 500 });
      }

      // Optionally update appointment status to "confirmed" when deposit is paid
      const appointmentId =
        (invoice.appointment_id as string | null) ??
        (customData?.appointment_id as string | null) ??
        null;

      if (appointmentId) {
        await admin
          .from("appointments")
          .update({ status: "confirmed" })
          .eq("id", appointmentId)
          .eq("status", "pending"); // only if still pending
      }

      console.log(
        `[paddle/webhook] Deposit paid — invoice ${invoice.id}, transaction ${paddleTransactionId}`
      );
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[paddle/webhook] Handler error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
