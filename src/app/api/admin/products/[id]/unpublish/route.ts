import { NextResponse } from "next/server";

import { AdminAuthError, requireAdmin } from "@/lib/auth/admin";
import { parseProductId, ValidationError } from "@/lib/products/validation";
import { unpublishProduct } from "@/lib/products/repository";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    requireAdmin(request);

    const { id } = await context.params;
    const productId = parseProductId(id);
    const product = await unpublishProduct(productId);

    if (!product) {
      return NextResponse.json(
        { error: "Product cannot be unpublished from its current state" },
        { status: 409 },
      );
    }

    return NextResponse.json({ product });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("PATCH /api/admin/products/[id]/unpublish failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
