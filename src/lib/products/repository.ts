import sql from "@/lib/db";
import type postgres from "postgres";
import type {
  AddProductImageInput,
  CreateProductInput,
  ProductListFilters,
  ProductStatus,
} from "@/lib/products/validation";

type SqlLike = postgres.Sql | postgres.TransactionSql;

export type ProductListItem = {
  id: number;
  slug: string;
  sku: string | null;
  name: string;
  description: string | null;
  category: string | null;
  priceCents: number;
  currency: string;
  status: ProductStatus;
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
  sku: string | null;
  name: string;
  description: string | null;
  category: string | null;
  conditionNote: string | null;
  dimensions: string | null;
  weightLbs: number | null;
  suggestedPriceLowCents: number | null;
  suggestedPriceHighCents: number | null;
  priceCents: number;
  currency: string;
  status: ProductStatus;
  inventoryQuantity: 0 | 1;
  publishedAt: Date | null;
  soldAt: Date | null;
  images: ProductImage[];
};

export type CheckoutProduct = {
  id: number;
  slug: string;
  sku: string | null;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
};

export type CsvImportRow = {
  sku: string;
  category: string | null;
  name: string;
  conditionNote: string | null;
  dimensions: string | null;
  weightLbs: number | null;
  suggestedPriceLowCents: number | null;
  suggestedPriceHighCents: number | null;
  description: string | null;
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
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)
    .toString(36)
    .padStart(2, "0")}`;
  return `${base}-${suffix}`;
}

function mapProductDetailRow(row: {
  id: number;
  slug: string;
  sku: string | null;
  name: string;
  description: string | null;
  category: string | null;
  condition_note: string | null;
  dimensions: string | null;
  weight_lbs: number | null;
  suggested_price_low_cents: number | null;
  suggested_price_high_cents: number | null;
  price_cents: number;
  currency: string;
  status: ProductStatus;
  inventory_quantity: 0 | 1;
  published_at: Date | null;
  sold_at: Date | null;
}): Omit<ProductDetail, "images"> {
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    description: row.description,
    category: row.category,
    conditionNote: row.condition_note,
    dimensions: row.dimensions,
    weightLbs: row.weight_lbs,
    suggestedPriceLowCents: row.suggested_price_low_cents,
    suggestedPriceHighCents: row.suggested_price_high_cents,
    priceCents: row.price_cents,
    currency: row.currency,
    status: row.status,
    inventoryQuantity: row.inventory_quantity,
    publishedAt: row.published_at,
    soldAt: row.sold_at,
  };
}

export async function listActiveProducts(): Promise<ProductListItem[]> {
  return listProducts({
    query: null,
    category: null,
    sort: "newest",
    limit: 24,
    activeOnly: true,
  });
}

export async function listActiveProductsWithFilters(
  filters: ProductListFilters,
): Promise<ProductListItem[]> {
  return listProducts({ ...filters, activeOnly: true });
}

export async function listAllProductsForAdmin(
  filters: ProductListFilters,
): Promise<ProductListItem[]> {
  return listProducts({ ...filters, activeOnly: false });
}

async function listProducts({
  query,
  category,
  sort,
  limit,
  activeOnly,
}: ProductListFilters & { activeOnly: boolean }): Promise<ProductListItem[]> {
  const whereClauses: string[] = [];
  const parameters: Array<string | number> = [];

  if (activeOnly) {
    whereClauses.push("p.status = 'ACTIVE'");
  }

  if (query) {
    parameters.push(`%${query}%`);
    const paramIndex = parameters.length;
    whereClauses.push(
      `(p.name ILIKE $${paramIndex} OR COALESCE(p.description, '') ILIKE $${paramIndex} OR COALESCE(p.sku, '') ILIKE $${paramIndex})`,
    );
  }

  if (category) {
    parameters.push(category);
    whereClauses.push(`p.category = $${parameters.length}`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const orderSql =
    sort === "price_asc"
      ? "ORDER BY p.price_cents ASC, p.created_at DESC"
      : sort === "price_desc"
        ? "ORDER BY p.price_cents DESC, p.created_at DESC"
        : "ORDER BY p.created_at DESC";

  parameters.push(limit);
  const limitParamIndex = parameters.length;

  const rows = await sql.unsafe<{
    id: number;
    slug: string;
    sku: string | null;
    name: string;
    description: string | null;
    category: string | null;
    price_cents: number;
    currency: string;
    status: ProductStatus;
    primary_image_url: string | null;
  }[]>(
    `
    SELECT
      p.id,
      p.slug,
      p.sku,
      p.name,
      p.description,
      p.category,
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
    ${whereSql}
    ${orderSql}
    LIMIT $${limitParamIndex}
    `,
    parameters,
  );

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    description: row.description,
    category: row.category,
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
    sku: string | null;
    name: string;
    description: string | null;
    category: string | null;
    condition_note: string | null;
    dimensions: string | null;
    weight_lbs: number | null;
    suggested_price_low_cents: number | null;
    suggested_price_high_cents: number | null;
    price_cents: number;
    currency: string;
    status: ProductStatus;
    inventory_quantity: 0 | 1;
    published_at: Date | null;
    sold_at: Date | null;
  }[]>`
    SELECT
      id,
      slug,
      sku,
      name,
      description,
      category,
      condition_note,
      dimensions,
      weight_lbs,
      suggested_price_low_cents,
      suggested_price_high_cents,
      price_cents,
      currency,
      status,
      inventory_quantity,
      published_at,
      sold_at
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

  const base = mapProductDetailRow(productRows[0]);

  return {
    ...base,
    images: imageRows.map((image) => ({
      id: image.id,
      imageUrl: image.image_url,
      altText: image.alt_text,
      position: image.position,
    })),
  };
}

export async function createProduct(input: CreateProductInput): Promise<ProductDetail> {
  const status = input.status ?? "DRAFT";

  let inventoryQuantity: 0 | 1 = input.quantity;
  if (status === "DRAFT" || status === "ACTIVE") {
    inventoryQuantity = 1;
  }

  if (status === "SOLD") {
    inventoryQuantity = 0;
  }

  const publishedAt = status === "ACTIVE" ? new Date() : null;
  const soldAt = status === "SOLD" ? new Date() : null;
  const slug = buildUniqueSlug(input.name);

  const rows = await sql<{
    id: number;
    slug: string;
    sku: string | null;
    name: string;
    description: string | null;
    category: string | null;
    condition_note: string | null;
    dimensions: string | null;
    weight_lbs: number | null;
    suggested_price_low_cents: number | null;
    suggested_price_high_cents: number | null;
    price_cents: number;
    currency: string;
    status: ProductStatus;
    inventory_quantity: 0 | 1;
    published_at: Date | null;
    sold_at: Date | null;
  }[]>`
    INSERT INTO products (
      slug,
      sku,
      name,
      description,
      category,
      condition_note,
      dimensions,
      weight_lbs,
      suggested_price_low_cents,
      suggested_price_high_cents,
      price_cents,
      currency,
      inventory_quantity,
      status,
      published_at,
      sold_at
    )
    VALUES (
      ${slug},
      ${input.sku},
      ${input.name},
      ${input.description},
      ${input.category},
      ${input.conditionNote},
      ${input.dimensions},
      ${input.weightLbs},
      ${input.suggestedPriceLowCents},
      ${input.suggestedPriceHighCents},
      ${input.priceCents},
      'USD',
      ${inventoryQuantity},
      ${status},
      ${publishedAt},
      ${soldAt}
    )
    RETURNING
      id,
      slug,
      sku,
      name,
      description,
      category,
      condition_note,
      dimensions,
      weight_lbs,
      suggested_price_low_cents,
      suggested_price_high_cents,
      price_cents,
      currency,
      status,
      inventory_quantity,
      published_at,
      sold_at
  `;

  const base = mapProductDetailRow(rows[0]);

  return {
    ...base,
    images: [],
  };
}

export async function publishProduct(productId: number): Promise<ProductDetail | null> {
  const rows = await sql<{
    id: number;
    slug: string;
    sku: string | null;
    name: string;
    description: string | null;
    category: string | null;
    condition_note: string | null;
    dimensions: string | null;
    weight_lbs: number | null;
    suggested_price_low_cents: number | null;
    suggested_price_high_cents: number | null;
    price_cents: number;
    currency: string;
    status: ProductStatus;
    inventory_quantity: 0 | 1;
    published_at: Date | null;
    sold_at: Date | null;
  }[]>`
    UPDATE products
    SET
      status = 'ACTIVE',
      published_at = NOW(),
      updated_at = NOW()
    WHERE
      id = ${productId}
      AND status = 'DRAFT'
      AND inventory_quantity = 1
      AND sold_at IS NULL
    RETURNING
      id,
      slug,
      sku,
      name,
      description,
      category,
      condition_note,
      dimensions,
      weight_lbs,
      suggested_price_low_cents,
      suggested_price_high_cents,
      price_cents,
      currency,
      status,
      inventory_quantity,
      published_at,
      sold_at
  `;

  if (rows.length === 0) {
    return null;
  }

  return { ...mapProductDetailRow(rows[0]), images: [] };
}

export async function unpublishProduct(productId: number): Promise<ProductDetail | null> {
  const rows = await sql<{
    id: number;
    slug: string;
    sku: string | null;
    name: string;
    description: string | null;
    category: string | null;
    condition_note: string | null;
    dimensions: string | null;
    weight_lbs: number | null;
    suggested_price_low_cents: number | null;
    suggested_price_high_cents: number | null;
    price_cents: number;
    currency: string;
    status: ProductStatus;
    inventory_quantity: 0 | 1;
    published_at: Date | null;
    sold_at: Date | null;
  }[]>`
    UPDATE products
    SET
      status = 'DRAFT',
      published_at = NULL,
      updated_at = NOW()
    WHERE
      id = ${productId}
      AND status = 'ACTIVE'
      AND inventory_quantity = 1
      AND sold_at IS NULL
    RETURNING
      id,
      slug,
      sku,
      name,
      description,
      category,
      condition_note,
      dimensions,
      weight_lbs,
      suggested_price_low_cents,
      suggested_price_high_cents,
      price_cents,
      currency,
      status,
      inventory_quantity,
      published_at,
      sold_at
  `;

  if (rows.length === 0) {
    return null;
  }

  return { ...mapProductDetailRow(rows[0]), images: [] };
}

export async function markProductSold(
  productId: number,
  soldAt: Date = new Date(),
  db: SqlLike = sql,
): Promise<ProductDetail | null> {
  const rows = await db.unsafe<
    {
      id: number;
      slug: string;
      sku: string | null;
      name: string;
      description: string | null;
      category: string | null;
      condition_note: string | null;
      dimensions: string | null;
      weight_lbs: number | null;
      suggested_price_low_cents: number | null;
      suggested_price_high_cents: number | null;
      price_cents: number;
      currency: string;
      status: ProductStatus;
      inventory_quantity: 0 | 1;
      published_at: Date | null;
      sold_at: Date | null;
    }[]
  >(
    `
    UPDATE products
    SET
      status = 'SOLD',
      inventory_quantity = 0,
      sold_at = $2,
      updated_at = NOW()
    WHERE
      id = $1
      AND status <> 'SOLD'
      AND inventory_quantity = 1
    RETURNING
      id,
      slug,
      sku,
      name,
      description,
      category,
      condition_note,
      dimensions,
      weight_lbs,
      suggested_price_low_cents,
      suggested_price_high_cents,
      price_cents,
      currency,
      status,
      inventory_quantity,
      published_at,
      sold_at
    `,
    [productId, soldAt],
  );

  if (rows.length === 0) {
    return null;
  }

  return { ...mapProductDetailRow(rows[0]), images: [] };
}

export async function getCheckoutEligibleProduct(productId: number): Promise<CheckoutProduct | null> {
  const rows = await sql<{
    id: number;
    slug: string;
    sku: string | null;
    name: string;
    description: string | null;
    price_cents: number;
    currency: string;
  }[]>`
    SELECT id, slug, sku, name, description, price_cents, currency
    FROM products
    WHERE id = ${productId}
      AND status = 'ACTIVE'
      AND inventory_quantity = 1
    LIMIT 1
  `;

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    currency: row.currency,
  };
}

export async function upsertDraftProductFromCsv(
  row: CsvImportRow,
): Promise<{ inserted: boolean; id: number }> {
  const slug = buildUniqueSlug(row.name);
  const fallbackPrice = row.suggestedPriceLowCents ?? row.suggestedPriceHighCents ?? 0;

  const rows = await sql.unsafe<{ id: number; inserted: boolean }[]>(
    `
    INSERT INTO products (
      slug,
      sku,
      name,
      description,
      category,
      condition_note,
      dimensions,
      weight_lbs,
      suggested_price_low_cents,
      suggested_price_high_cents,
      price_cents,
      currency,
      inventory_quantity,
      status,
      published_at,
      sold_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      'USD',
      1,
      'DRAFT',
      NULL,
      NULL
    )
    ON CONFLICT (sku)
    DO UPDATE SET
      name = COALESCE(NULLIF(products.name, ''), EXCLUDED.name),
      description = COALESCE(NULLIF(products.description, ''), EXCLUDED.description),
      category = COALESCE(NULLIF(products.category, ''), EXCLUDED.category),
      condition_note = COALESCE(NULLIF(products.condition_note, ''), EXCLUDED.condition_note),
      dimensions = COALESCE(NULLIF(products.dimensions, ''), EXCLUDED.dimensions),
      weight_lbs = COALESCE(products.weight_lbs, EXCLUDED.weight_lbs),
      suggested_price_low_cents = COALESCE(products.suggested_price_low_cents, EXCLUDED.suggested_price_low_cents),
      suggested_price_high_cents = COALESCE(products.suggested_price_high_cents, EXCLUDED.suggested_price_high_cents),
      price_cents = CASE
        WHEN products.price_cents = 0 THEN EXCLUDED.price_cents
        ELSE products.price_cents
      END,
      updated_at = NOW()
    RETURNING id, (xmax = 0) AS inserted
    `,
    [
      slug,
      row.sku,
      row.name,
      row.description,
      row.category,
      row.conditionNote,
      row.dimensions,
      row.weightLbs,
      row.suggestedPriceLowCents,
      row.suggestedPriceHighCents,
      fallbackPrice,
    ],
  );

  return rows[0];
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
