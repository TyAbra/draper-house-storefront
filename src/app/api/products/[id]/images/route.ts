import { NextResponse } from "next/server";

import { AdminAuthError, requireAdmin } from "@/lib/auth/admin";
import { addProductImage } from "@/lib/products/repository";
import {
  parseAddProductImageBody,
  parseProductId,
  ValidationError,
} from "@/lib/products/validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    requireAdmin(request);

    const { id } = await context.params;
    const productId = parseProductId(id);
    const body = await request.json();
    const input = parseAddProductImageBody(body);

    const image = await addProductImage(productId, input);

    if (!image) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("POST /api/products/[id]/images failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
