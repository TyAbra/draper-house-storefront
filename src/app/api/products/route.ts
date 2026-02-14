import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

import { AdminAuthError, requireAdmin } from "@/lib/auth/admin";
import { createProduct, listActiveProducts } from "@/lib/products/repository";
import { parseCreateProductBody, ValidationError } from "@/lib/products/validation";

export async function GET() {
  try {
    const products = await listActiveProducts();
    return NextResponse.json({ products });
  } catch (error) {
    console.error("GET /api/products failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    requireAdmin(request);

    const body = await request.json();
    const input = parseCreateProductBody(body);
    const product = await createProduct(input);

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error("POST /api/products failed", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
