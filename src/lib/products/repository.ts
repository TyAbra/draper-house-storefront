import sql from "@/lib/db";
import type postgres from "postgres";
import type {
  AddProductImageInput,
  CreateProductInput,
  ProductListFilters,
  ProductStatus,
  UpdateProductInput,
} from "@/lib/products/validation";

type SqlLike = postgres.Sql | postgres.TransactionSql;

// ── Shared new-column types ───────────────────────────────────────────────────
// Added in migration 0008. All nullable so existing rows are unaffected.
type InventoryFields = {
  // Acquisition
  yearOfPurchase: string | null;
  purchaseDate: string | null;
  storeSource: string | null;
  receiptPhotoLink: string | null;
  receiptDocumentation: string | null;
  // Cost / financials
  cogCents: number | null;
  finalSalesPriceCents: number | null;
  shippingCents: number | null;
  taxesCents: number | null;
  // Content / logistics
  imageLink: string | null;
  itemDescription: string | null;
  sellSiteLocation: string | null;
  measurements: string | null;
};

export type ProductListItem = {
  id: number;
  slug: string;
  sku: string | null;
  name: string;
  description: string | null;
  category: string | null;
  conditionNote: string | null;
  dimensions: string | null;
  priceCents: number;
  suggestedPriceLowCents: number | null;
  suggestedPriceHighCents: number | null;
  currency: string;
  status: ProductStatus;
  inventoryQuantity: 0 | 1;
  createdAt: Date;
  soldAt: Date | null;
  shipDate: string | null;
  primaryImageUrl: string | null;
} & InventoryFields;

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
  shipDate: string | null;
  createdAt: Date;
  images: ProductImage[];
} & InventoryFields;

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

// ── Row shape returned by SELECT with all columns ────────────────────────────
type FullProductRow = {
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
  ship_date: string | null;
  created_at: Date;
  // migration 0008 fields
  year_of_purchase: string | null;
  purchase_date: string | null;
  store_source: string | null;
  receipt_photo_link: string | null;
  receipt_documentation: string | null;
  cog_cents: number | null;
  final_sales_price_cents: number | null;
  shipping_cents: number | null;
  taxes_cents: number | null;
  image_link: string | null;
  item_description: string | null;
  sell_site_location: string | null;
  measurements: string | null;
};

const FULL_SELECT = `
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
  sold_at,
  ship_date,
  created_at,
  year_of_purchase,
  purchase_date,
  store_source,
  receipt_photo_link,
  receipt_documentation,
  cog_cents,
  final_sales_price_cents,
  shipping_cents,
  taxes_cents,
  image_link,
  item_description,
  sell_site_location,
  measurements
`;

function mapInventoryFields(row: FullProductRow): InventoryFields {
  return {
    yearOfPurchase: row.year_of_purchase,
    purchaseDate: row.purchase_date,
    storeSource: row.store_source,
    receiptPhotoLink: row.receipt_photo_link,
    receiptDocumentation: row.receipt_documentation,
    cogCents: row.cog_cents,
    finalSalesPriceCents: row.final_sales_price_cents,
    shippingCents: row.shipping_cents,
    taxesCents: row.taxes_cents,
    imageLink: row.image_link,
    itemDescription: row.item_description,
    sellSiteLocation: row.sell_site_location,
    measurements: row.measurements,
  };
}

function mapProductDetailRow(row: FullProductRow): Omit<ProductDetail, "images"> {
  return {
    id: Number(row.id),
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
    shipDate: row.ship_date,
    createdAt: row.created_at,
    ...mapInventoryFields(row),
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
  // Admin needs all records — no LIMIT applied
  return listProducts({ ...filters, limit: null, activeOnly: false });
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

  let limitSql = "";
  if (limit !== null) {
    parameters.push(limit);
    limitSql = `LIMIT $${parameters.length}`;
  }

  const rows = await sql.unsafe<
    (FullProductRow & { primary_image_url: string | null })[]
  >(
    `
    SELECT
      p.id,
      p.slug,
      p.sku,
      p.name,
      p.description,
      p.category,
      p.condition_note,
      p.dimensions,
      p.weight_lbs,
      p.suggested_price_low_cents,
      p.suggested_price_high_cents,
      p.price_cents,
      p.currency,
      p.status,
      p.inventory_quantity,
      p.published_at,
      p.created_at,
      p.sold_at,
      p.ship_date,
      p.year_of_purchase,
      p.purchase_date,
      p.store_source,
      p.receipt_photo_link,
      p.receipt_documentation,
      p.cog_cents,
      p.final_sales_price_cents,
      p.shipping_cents,
      p.taxes_cents,
      p.image_link,
      p.item_description,
      p.sell_site_location,
      p.measurements,
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
    ${limitSql}
    `,
    parameters,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    slug: row.slug,
    sku: row.sku,
    name: row.name,
    description: row.description,
    category: row.category,
    conditionNote: row.condition_note,
    dimensions: row.dimensions,
    priceCents: row.price_cents,
    suggestedPriceLowCents: row.suggested_price_low_cents,
    suggestedPriceHighCents: row.suggested_price_high_cents,
    currency: row.currency,
    status: row.status,
    inventoryQuantity: row.inventory_quantity as 0 | 1,
    createdAt: row.created_at,
    soldAt: row.sold_at,
    shipDate: row.ship_date,
    primaryImageUrl: row.primary_image_url,
    ...mapInventoryFields(row),
  }));
}

export async function getProductById(productId: number): Promise<ProductDetail | null> {
  const productRows = await sql.unsafe<FullProductRow[]>(
    `SELECT ${FULL_SELECT} FROM products WHERE id = $1 LIMIT 1`,
    [productId],
  );

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
  if (status === "DRAFT" || status === "READY" || status === "ACTIVE") {
    inventoryQuantity = 1;
  }

  if (status === "SOLD") {
    inventoryQuantity = 0;
  }

  const publishedAt = status === "ACTIVE" ? new Date() : null;
  const soldAt = status === "SOLD" ? new Date() : null;
  const slug = buildUniqueSlug(input.name);

  const rows = await sql.unsafe<FullProductRow[]>(
    `
    INSERT INTO products (
      slug, sku, name, description, item_description, category, condition_note,
      dimensions, measurements, weight_lbs,
      year_of_purchase, purchase_date, store_source,
      receipt_photo_link, receipt_documentation,
      cog_cents, suggested_price_low_cents, suggested_price_high_cents, price_cents,
      final_sales_price_cents, shipping_cents, taxes_cents,
      image_link, sell_site_location,
      currency, inventory_quantity, status, published_at, sold_at, ship_date
    )
    VALUES (
      $1,  $2,  $3,  $4,  $5,  $6,  $7,
      $8,  $9,  $10,
      $11, $12, $13,
      $14, $15,
      $16, $17, $18, $19,
      $20, $21, $22,
      $23, $24,
      'USD', $25, $26, $27, $28, $29
    )
    RETURNING ${FULL_SELECT}
    `,
    [
      slug, input.sku, input.name, input.description, input.itemDescription,
      input.category, input.conditionNote,
      input.dimensions, input.measurements, input.weightLbs,
      input.yearOfPurchase, input.purchaseDate, input.storeSource,
      input.receiptPhotoLink, input.receiptDocumentation,
      input.cogCents, input.suggestedPriceLowCents, input.suggestedPriceHighCents, input.priceCents,
      input.finalSalesPriceCents, input.shippingCents, input.taxesCents,
      input.imageLink, input.sellSiteLocation,
      inventoryQuantity, status, publishedAt, soldAt, input.shipDate ?? null,
    ],
  );

  const base = mapProductDetailRow(rows[0]);
  return { ...base, images: [] };
}

export async function updateProduct(
  productId: number,
  input: UpdateProductInput,
): Promise<ProductDetail | null> {
  const setClauses: string[] = ["updated_at = NOW()"];
  const parameters: Array<string | number | null | Date> = [];

  function addParam(value: string | number | null | Date | undefined): string {
    parameters.push(value ?? null);
    return `$${parameters.length}`;
  }

  if (input.name !== undefined) setClauses.push(`name = ${addParam(input.name)}`);
  if (input.sku !== undefined) setClauses.push(`sku = ${addParam(input.sku)}`);
  if (input.category !== undefined) setClauses.push(`category = ${addParam(input.category)}`);
  if (input.description !== undefined) setClauses.push(`description = ${addParam(input.description)}`);
  if (input.itemDescription !== undefined) setClauses.push(`item_description = ${addParam(input.itemDescription)}`);
  if (input.conditionNote !== undefined) setClauses.push(`condition_note = ${addParam(input.conditionNote)}`);
  if (input.dimensions !== undefined) setClauses.push(`dimensions = ${addParam(input.dimensions)}`);
  if (input.measurements !== undefined) setClauses.push(`measurements = ${addParam(input.measurements)}`);
  if (input.weightLbs !== undefined) setClauses.push(`weight_lbs = ${addParam(input.weightLbs)}`);
  if (input.yearOfPurchase !== undefined) setClauses.push(`year_of_purchase = ${addParam(input.yearOfPurchase)}`);
  if (input.purchaseDate !== undefined) setClauses.push(`purchase_date = ${addParam(input.purchaseDate)}`);
  if (input.storeSource !== undefined) setClauses.push(`store_source = ${addParam(input.storeSource)}`);
  if (input.receiptPhotoLink !== undefined) setClauses.push(`receipt_photo_link = ${addParam(input.receiptPhotoLink)}`);
  if (input.receiptDocumentation !== undefined) setClauses.push(`receipt_documentation = ${addParam(input.receiptDocumentation)}`);
  if (input.cogCents !== undefined) setClauses.push(`cog_cents = ${addParam(input.cogCents)}`);
  if (input.suggestedPriceLowCents !== undefined) setClauses.push(`suggested_price_low_cents = ${addParam(input.suggestedPriceLowCents)}`);
  if (input.suggestedPriceHighCents !== undefined) setClauses.push(`suggested_price_high_cents = ${addParam(input.suggestedPriceHighCents)}`);
  if (input.priceCents !== undefined) setClauses.push(`price_cents = ${addParam(input.priceCents)}`);
  if (input.finalSalesPriceCents !== undefined) setClauses.push(`final_sales_price_cents = ${addParam(input.finalSalesPriceCents)}`);
  if (input.shippingCents !== undefined) setClauses.push(`shipping_cents = ${addParam(input.shippingCents)}`);
  if (input.taxesCents !== undefined) setClauses.push(`taxes_cents = ${addParam(input.taxesCents)}`);
  if (input.imageLink !== undefined) setClauses.push(`image_link = ${addParam(input.imageLink)}`);
  if (input.sellSiteLocation !== undefined) setClauses.push(`sell_site_location = ${addParam(input.sellSiteLocation)}`);
  if (input.shipDate !== undefined) setClauses.push(`ship_date = ${addParam(input.shipDate)}`);

  if (setClauses.length === 1) {
    return getProductById(productId);
  }

  parameters.push(productId);
  const idParam = `$${parameters.length}`;

  const rows = await sql.unsafe<FullProductRow[]>(
    `
    UPDATE products
    SET ${setClauses.join(", ")}
    WHERE id = ${idParam}
    RETURNING ${FULL_SELECT}
    `,
    parameters,
  );

  if (rows.length === 0) return null;
  return { ...mapProductDetailRow(rows[0]), images: [] };
}

export async function markProductReady(productId: number): Promise<ProductDetail | null> {
  const rows = await sql.unsafe<FullProductRow[]>(
    `
    UPDATE products
    SET status = 'READY', updated_at = NOW()
    WHERE id = $1 AND status = 'DRAFT' AND inventory_quantity = 1 AND sold_at IS NULL
    RETURNING ${FULL_SELECT}
    `,
    [productId],
  );
  if (rows.length === 0) return null;
  return { ...mapProductDetailRow(rows[0]), images: [] };
}

export async function publishProduct(productId: number): Promise<ProductDetail | null> {
  const rows = await sql.unsafe<FullProductRow[]>(
    `
    UPDATE products
    SET status = 'ACTIVE', published_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND status IN ('DRAFT', 'READY') AND inventory_quantity = 1 AND sold_at IS NULL
    RETURNING ${FULL_SELECT}
    `,
    [productId],
  );
  if (rows.length === 0) return null;
  return { ...mapProductDetailRow(rows[0]), images: [] };
}

export async function unpublishProduct(productId: number): Promise<ProductDetail | null> {
  const rows = await sql.unsafe<FullProductRow[]>(
    `
    UPDATE products
    SET status = 'DRAFT', published_at = NULL, updated_at = NOW()
    WHERE id = $1 AND status = 'ACTIVE' AND inventory_quantity = 1 AND sold_at IS NULL
    RETURNING ${FULL_SELECT}
    `,
    [productId],
  );
  if (rows.length === 0) return null;
  return { ...mapProductDetailRow(rows[0]), images: [] };
}

export async function markProductSold(
  productId: number,
  soldAt: Date = new Date(),
  db: SqlLike = sql,
): Promise<ProductDetail | null> {
  const rows = await db.unsafe<FullProductRow[]>(
    `
    UPDATE products
    SET status = 'SOLD', inventory_quantity = 0, sold_at = $2, updated_at = NOW()
    WHERE id = $1 AND status <> 'SOLD' AND inventory_quantity = 1
    RETURNING ${FULL_SELECT}
    `,
    [productId, soldAt],
  );
  if (rows.length === 0) return null;
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
    id: Number(row.id),
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
      slug, sku, name, description, category, condition_note, dimensions,
      weight_lbs, suggested_price_low_cents, suggested_price_high_cents,
      price_cents, currency, inventory_quantity, status, published_at, sold_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'USD',1,'DRAFT',NULL,NULL)
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
      price_cents = CASE WHEN products.price_cents = 0 THEN EXCLUDED.price_cents ELSE products.price_cents END,
      updated_at = NOW()
    RETURNING id, (xmax = 0) AS inserted
    `,
    [
      slug, row.sku, row.name, row.description, row.category, row.conditionNote,
      row.dimensions, row.weightLbs, row.suggestedPriceLowCents, row.suggestedPriceHighCents,
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
      `SELECT id FROM products WHERE id = $1 FOR UPDATE`,
      [productId],
    );

    if (product.length === 0) {
      return null;
    }

    const nextPositionRow = await tx.unsafe<{ next_position: number }[]>(
      `SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM product_images WHERE product_id = $1`,
      [productId],
    );

    const position = nextPositionRow[0].next_position;

    const inserted = await tx.unsafe<{
      id: number;
      image_url: string;
      alt_text: string | null;
      position: number;
    }[]>(
      `INSERT INTO product_images (product_id, image_url, alt_text, position)
       VALUES ($1, $2, $3, $4)
       RETURNING id, image_url, alt_text, position`,
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

export async function generateNextSku(): Promise<string> {
  // Find the highest numeric suffix among all SKU-NNN formatted SKUs
  const rows = await sql.unsafe<{ max_num: string | null }[]>(
    `SELECT MAX(CAST(SUBSTRING(sku FROM 5) AS INTEGER)) AS max_num
     FROM products
     WHERE sku ~ '^SKU-[0-9]+$'`,
  );
  const current = rows[0]?.max_num ? Number(rows[0].max_num) : 0;
  const next = current + 1;
  // Zero-pad to at least 3 digits (SKU-001 … SKU-999, then SKU-1000 …)
  return `SKU-${String(next).padStart(3, "0")}`;
}
