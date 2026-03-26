/**
 * POST /api/paddle/create-deposit-checkout
 *
 * Creates a Paddle transaction for a client deposit and saves a pending
 * invoice record to the database.
 *
 * Required DB migrations (run once in Supabase SQL editor):
 *   ALTER TABLE invoices ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL;
 *   ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paddle_transaction_id text;
 *   ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paddle_checkout_url text;
 *   ALTER TABLE invoices ADD COLUMN IF NOT EXISTS description text;
 *   ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
 */
import { NextResponse, type NextRequest } from "next/server";
import { getPaddle } from "@/lib/paddle/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CurrencyCode } from "@paddle/paddle-node-sdk";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      amount,
      currency = "USD",
      client_name,
      client_email,
      appointment_id,
      description,
    } = body as {
      amount: number;
      currency?: string;
      client_name: string;
      client_email?: string;
      appointment_id?: string;
      description?: string;
    };

    // Auth
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }
    if (!client_name) {
      return NextResponse.json({ error: "client_name is required" }, { status: 400 });
    }

    const paddle = getPaddle();
    // Paddle amounts are in the smallest currency unit (cents for USD/EUR/GBP, agoras for ILS)
    const amountInCents = String(Math.round(amount * 100));
    const depositDescription = description || `Deposit — ${client_name}`;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const transaction = await paddle.transactions.create({
      items: [
        {
          price: {
            description: depositDescription,
            name: depositDescription,
            unitPrice: {
              amount: amountInCents,
              currencyCode: currency as CurrencyCode,
            },
            // No billingCycle = one-time payment
            taxMode: "external", // amount already includes tax
            product: {
              name: "Tattoo Deposit",
              taxCategory: "standard",
            },
          },
          quantity: 1,
        },
      ],
      customData: {
        user_id: user.id,
        appointment_id: appointment_id ?? null,
        type: "deposit",
      },
      checkout: {
        url: `${siteUrl}/calendar?deposit_paid=1`,
      },
    });

    const checkoutUrl = transaction.checkout?.url ?? null;
    const transactionId = transaction.id;

    // Persist a pending invoice record
    const admin = getSupabaseAdmin();

    // Resolve client_id from appointment if available
    let clientId: string | null = null;
    if (appointment_id) {
      const { data: appt } = await admin
        .from("appointments")
        .select("client_id")
        .eq("id", appointment_id)
        .single();
      clientId = appt?.client_id ?? null;
    }

    const { data: invoice, error: invoiceError } = await admin
      .from("invoices")
      .insert({
        user_id: user.id,
        client_id: clientId,
        amount,
        currency,
        status: "pending",
        type: "deposit",
        date: new Date().toISOString().split("T")[0],
        appointment_id: appointment_id ?? null,
        paddle_transaction_id: transactionId,
        paddle_checkout_url: checkoutUrl,
        description: depositDescription,
      })
      .select("id")
      .single();

    if (invoiceError) {
      // Log but don't fail — Paddle transaction was already created
      console.error("[create-deposit-checkout] Invoice insert error:", invoiceError.message);
    }

    return NextResponse.json({
      checkout_url: checkoutUrl,
      transaction_id: transactionId,
      invoice_id: invoice?.id ?? null,
    });
  } catch (err) {
    console.error("[create-deposit-checkout] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
