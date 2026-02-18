import { NextResponse } from "next/server";

import { AdminAuthError, requireAdmin } from "@/lib/auth/admin";
import { createProduct, listAllProductsForAdmin } from "@/lib/products/repository";
import {
  parseCreateProductBody,
  parseProductListFilters,
  ValidationError,
} from "@/lib/products/validation";

export async function GET(request: Request) {
  try {
    requireAdmin(request);

    const filters = parseProductListFilters(new URL(request.url).searchParams);
    const products = await listAllProductsForAdmin(filters);

    return NextResponse.json({ products });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("GET /api/admin/products failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("POST /api/admin/products failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
