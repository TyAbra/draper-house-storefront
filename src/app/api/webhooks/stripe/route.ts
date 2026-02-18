import { NextResponse } from "next/server";

import sql from "@/lib/db";
import { markProductSold } from "@/lib/products/repository";
import { getStripeClient } from "@/lib/stripe";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Invalid webhook configuration" }, { status: 400 });
  }

  const payload = await request.text();

  let event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const claimed = await sql.unsafe<{ id: number }[]>(
      `
      INSERT INTO processed_stripe_events (
        stripe_event_id,
        event_type,
        livemode,
        processing_status,
        received_at
      )
      VALUES ($1, $2, $3, 'PROCESSING', NOW())
      ON CONFLICT (stripe_event_id) DO NOTHING
      RETURNING id
      `,
      [event.id, event.type, event.livemode],
    );

    if (claimed.length === 0) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const productIdRaw = session.metadata?.productId;
      const productId = productIdRaw ? Number.parseInt(productIdRaw, 10) : Number.NaN;

      if (Number.isInteger(productId) && productId > 0) {
        const outcome = await sql.begin(async (tx) => {
          const productRows = await tx.unsafe<
            {
              id: number;
              status: string;
              inventory_quantity: number;
              price_cents: number;
              currency: string;
            }[]
          >(
            `
            SELECT id, status, inventory_quantity, price_cents, currency
            FROM products
            WHERE id = $1
            FOR UPDATE
            `,
            [productId],
          );

          if (productRows.length === 0) {
            return { kind: "missing_product" as const };
          }

          const product = productRows[0];
          if (product.status === "SOLD" || product.inventory_quantity !== 1) {
            return { kind: "already_sold" as const };
          }

          const soldProduct = await markProductSold(productId, new Date(), tx);
          if (!soldProduct) {
            return { kind: "already_sold" as const };
          }

          const amountTotal = session.amount_total ?? soldProduct.priceCents;
          const currency = (session.currency ?? soldProduct.currency).toUpperCase();
          const paidAt = new Date();

          const orderRows = await tx.unsafe<{ id: number }[]>(
            `
            INSERT INTO orders (
              status,
              stripe_checkout_session_id,
              stripe_payment_intent_id,
              buyer_email,
              subtotal_cents,
              total_cents,
              currency,
              paid_at,
              created_at,
              updated_at
            )
            VALUES (
              'PAID',
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              NOW(),
              NOW()
            )
            RETURNING id
            `,
            [
              session.id,
              typeof session.payment_intent === "string" ? session.payment_intent : null,
              session.customer_details?.email ?? null,
              amountTotal,
              amountTotal,
              currency,
              paidAt,
            ],
          );

          const orderId = orderRows[0].id;

          await tx.unsafe(
            `
            INSERT INTO order_items (
              order_id,
              product_id,
              quantity,
              unit_price_cents,
              currency,
              paid,
              created_at,
              updated_at
            )
            VALUES ($1, $2, 1, $3, $4, TRUE, NOW(), NOW())
            `,
            [orderId, productId, soldProduct.priceCents, soldProduct.currency],
          );

          return { kind: "processed" as const, orderId };
        });

        if (outcome.kind !== "processed") {
          await sql.unsafe(
            `
            UPDATE processed_stripe_events
            SET processing_status = 'PROCESSED', processed_at = NOW(), error_message = $2
            WHERE stripe_event_id = $1
            `,
            [event.id, outcome.kind],
          );

          return NextResponse.json({ received: true, status: outcome.kind });
        }
      }
    }

    await sql.unsafe(
      `
      UPDATE processed_stripe_events
      SET processing_status = 'PROCESSED', processed_at = NOW(), error_message = NULL
      WHERE stripe_event_id = $1
      `,
      [event.id],
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    await sql.unsafe(
      `
      UPDATE processed_stripe_events
      SET processing_status = 'FAILED', processed_at = NOW(), error_message = $2
      WHERE stripe_event_id = $1
      `,
      [event.id, error instanceof Error ? error.message.slice(0, 500) : "unknown_error"],
    );

    console.error("POST /api/webhooks/stripe failed", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
