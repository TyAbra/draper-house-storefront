import sql from "@/lib/db";
import type { AddProductImageInput, CreateProductInput } from "@/lib/products/validation";

export type ProductListItem = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  status: "ACTIVE" | "SOLD";
  primaryImageUrl: string | null;
};

export type ProductImage = {
  id: number;
  imageUrl: string;
  altText: string | null;
  position: number;
};

export type ProductDetail = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  status: "ACTIVE" | "SOLD";
  inventoryQuantity: 0 | 1;
  images: ProductImage[];
};

function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function buildUniqueSlug(name: string): string {
  const base = slugifyName(name) || "product";
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000).toString(36)}`;
  return `${base}-${suffix}`;
}

export async function listActiveProducts(): Promise<ProductListItem[]> {
  const rows = await sql<{
    id: number;
    slug: string;
    name: string;
    description: string | null;
    price_cents: number;
    currency: string;
    status: "ACTIVE" | "SOLD";
    primary_image_url: string | null;
  }[]>`
    SELECT
      p.id,
      p.slug,
      p.name,
      p.description,
      p.price_cents,
      p.currency,
      p.status,
      img.image_url AS primary_image_url
    FROM products p
    LEFT JOIN LATERAL (
      SELECT pi.image_url
      FROM product_images pi
      WHERE pi.product_id = p.id
      ORDER BY pi.position ASC, pi.id ASC
      LIMIT 1
    ) img ON TRUE
    WHERE p.status = 'ACTIVE'
    ORDER BY p.created_at DESC
  `;

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    currency: row.currency,
    status: row.status,
    primaryImageUrl: row.primary_image_url,
  }));
}

export async function getProductById(productId: number): Promise<ProductDetail | null> {
  const productRows = await sql<{
    id: number;
    slug: string;
    name: string;
    description: string | null;
    price_cents: number;
    currency: string;
    status: "ACTIVE" | "SOLD";
    inventory_quantity: 0 | 1;
  }[]>`
    SELECT
      id,
      slug,
      name,
      description,
      price_cents,
      currency,
      status,
      inventory_quantity
    FROM products
    WHERE id = ${productId}
    LIMIT 1
  `;

  if (productRows.length === 0) {
    return null;
  }

  const imageRows = await sql<{
    id: number;
    image_url: string;
    alt_text: string | null;
    position: number;
  }[]>`
    SELECT id, image_url, alt_text, position
    FROM product_images
    WHERE product_id = ${productId}
    ORDER BY position ASC, id ASC
  `;

  const product = productRows[0];

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    priceCents: product.price_cents,
    currency: product.currency,
    status: product.status,
    inventoryQuantity: product.inventory_quantity,
    images: imageRows.map((image) => ({
      id: image.id,
      imageUrl: image.image_url,
      altText: image.alt_text,
      position: image.position,
    })),
  };
}

export async function createProduct(input: CreateProductInput): Promise<ProductDetail> {
  const status = input.quantity === 1 ? "ACTIVE" : "SOLD";
  const soldAt = input.quantity === 1 ? null : new Date();
  const slug = buildUniqueSlug(input.name);

  const rows = await sql<{
    id: number;
    slug: string;
    name: string;
    description: string | null;
    price_cents: number;
    currency: string;
    status: "ACTIVE" | "SOLD";
    inventory_quantity: 0 | 1;
  }[]>`
    INSERT INTO products (
      slug,
      name,
      description,
      price_cents,
      currency,
      inventory_quantity,
      status,
      sold_at
    )
    VALUES (
      ${slug},
      ${input.name},
      ${input.description},
      ${input.priceCents},
      'USD',
      ${input.quantity},
      ${status},
      ${soldAt}
    )
    RETURNING id, slug, name, description, price_cents, currency, status, inventory_quantity
  `;

  const created = rows[0];

  return {
    id: created.id,
    slug: created.slug,
    name: created.name,
    description: created.description,
    priceCents: created.price_cents,
    currency: created.currency,
    status: created.status,
    inventoryQuantity: created.inventory_quantity,
    images: [],
  };
}

export async function addProductImage(
  productId: number,
  input: AddProductImageInput,
): Promise<ProductImage | null> {
  return sql.begin(async (tx) => {
    const product = await tx.unsafe<{ id: number }[]>(
      `
      SELECT id
      FROM products
      WHERE id = $1
      FOR UPDATE
      `,
      [productId],
    );

    if (product.length === 0) {
      return null;
    }

    const nextPositionRow = await tx.unsafe<{ next_position: number }[]>(
      `
      SELECT COALESCE(MAX(position), -1) + 1 AS next_position
      FROM product_images
      WHERE product_id = $1
      `,
      [productId],
    );

    const position = nextPositionRow[0].next_position;

    const inserted = await tx.unsafe<
      {
        id: number;
        image_url: string;
        alt_text: string | null;
        position: number;
      }[]
    >(
      `
      INSERT INTO product_images (product_id, image_url, alt_text, position)
      VALUES ($1, $2, $3, $4)
      RETURNING id, image_url, alt_text, position
      `,
      [productId, input.imageUrl, input.altText, position],
    );

    const image = inserted[0];

    return {
      id: image.id,
      imageUrl: image.image_url,
      altText: image.alt_text,
      position: image.position,
    };
  });
}
