import { NextResponse } from "next/server";

import { getCheckoutEligibleProduct } from "@/lib/products/repository";
import { parseCheckoutBody, ValidationError } from "@/lib/products/validation";
import { getStripeClient } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = parseCheckoutBody(body);

    const product = await getCheckoutEligibleProduct(input.productId);
    if (!product) {
      return NextResponse.json({ error: "Product is not available for checkout" }, { status: 409 });
    }

    const stripe = getStripeClient();
    const successUrl = process.env.STRIPE_SUCCESS_URL;
    const cancelUrl = process.env.STRIPE_CANCEL_URL;

    if (!successUrl || !cancelUrl) {
      throw new Error("STRIPE_SUCCESS_URL and STRIPE_CANCEL_URL must be configured");
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: product.currency.toLowerCase(),
            unit_amount: product.priceCents,
            product_data: {
              name: product.name,
              description: product.description ?? undefined,
            },
          },
        },
      ],
      metadata: {
        productId: String(product.id),
        sku: product.sku ?? "",
        slug: product.slug,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("POST /api/checkout failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
