export type ProductStatus = "DRAFT" | "READY" | "ACTIVE" | "SOLD";

export type CreateProductInput = {
  // Identity
  name: string;
  sku: string | null;
  category: string | null;
  // Descriptions
  description: string | null;        // Full Product Description (for listing)
  itemDescription: string | null;    // Item Description (internal notes)
  // Condition
  conditionNote: string | null;
  // Physical
  dimensions: string | null;
  measurements: string | null;
  // Acquisition
  yearOfPurchase: string | null;
  purchaseDate: string | null;
  storeSource: string | null;
  receiptPhotoLink: string | null;
  receiptDocumentation: string | null;
  // Pricing / financials
  cogCents: number | null;
  suggestedPriceLowCents: number | null;
  suggestedPriceHighCents: number | null;
  priceCents: number;
  finalSalesPriceCents: number | null;
  shippingCents: number | null;
  taxesCents: number | null;
  // Media / logistics
  imageLink: string | null;
  sellSiteLocation: string | null;
  shipDate: string | null;
  // Lifecycle
  status: ProductStatus;
  quantity: 0 | 1;
  weightLbs: number | null;
};

export type UpdateProductInput = {
  // Identity
  name?: string;
  sku?: string | null;
  category?: string | null;
  // Descriptions
  description?: string | null;
  itemDescription?: string | null;
  // Condition
  conditionNote?: string | null;
  // Physical
  dimensions?: string | null;
  measurements?: string | null;
  // Acquisition
  yearOfPurchase?: string | null;
  purchaseDate?: string | null;
  storeSource?: string | null;
  receiptPhotoLink?: string | null;
  receiptDocumentation?: string | null;
  // Pricing / financials
  cogCents?: number | null;
  suggestedPriceLowCents?: number | null;
  suggestedPriceHighCents?: number | null;
  priceCents?: number;
  finalSalesPriceCents?: number | null;
  shippingCents?: number | null;
  taxesCents?: number | null;
  // Media / logistics
  imageLink?: string | null;
  sellSiteLocation?: string | null;
  shipDate?: string | null;
  weightLbs?: number | null;
};

export type AddProductImageInput = {
  imageUrl: string;
  altText: string | null;
};

export type ProductListSort = "newest" | "price_asc" | "price_desc";

export type ProductListFilters = {
  query: string | null;
  category: string | null;
  sort: ProductListSort;
  limit: number | null; // null = no LIMIT (admin full-fetch)
};

export type CheckoutInput = {
  productId: number;
};

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function parseNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${field} must be a non-empty string`);
  }

  return value.trim();
}

function parseOptionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePriceToCents(value: unknown, field: string): number {
  const raw =
    typeof value === "string"
      ? Number.parseFloat(value)
      : typeof value === "number"
        ? value
        : Number.NaN;

  if (!Number.isFinite(raw) || raw < 0) {
    throw new ValidationError(`${field} must be a non-negative number`);
  }

  return Math.round(raw * 100);
}

function parseOptionalPriceToCents(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return parsePriceToCents(value, field);
}

function parseSingleQuantity(value: unknown): 0 | 1 {
  const quantity =
    typeof value === "string"
      ? Number.parseInt(value, 10)
      : typeof value === "number"
        ? value
        : Number.NaN;

  if (!Number.isInteger(quantity) || (quantity !== 0 && quantity !== 1)) {
    throw new ValidationError("quantity must be 0 or 1");
  }

  return quantity;
}

function parseOptionalPositiveNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed =
    typeof value === "string"
      ? Number.parseFloat(value)
      : typeof value === "number"
        ? value
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ValidationError(`${field} must be a non-negative number`);
  }

  return parsed;
}

function parseStatus(value: unknown): ProductStatus {
  if (value === undefined || value === null || value === "") {
    return "DRAFT";
  }

  if (value === "DRAFT" || value === "READY" || value === "ACTIVE" || value === "SOLD") {
    return value;
  }

  throw new ValidationError("status must be one of: DRAFT, READY, ACTIVE, SOLD");
}

function parseOptionalDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a date string`);
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new ValidationError(`${field} must be in YYYY-MM-DD format`);
  }

  return trimmed;
}

function parseLimit(value: string | null): number | null {
  if (!value) {
    return 24; // storefront default; admin overrides to null before calling listAllProductsForAdmin
  }

  const limit = Number.parseInt(value, 10);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new ValidationError("limit must be a positive integer");
  }

  return Math.min(limit, 100);
}

function parseSort(value: string | null): ProductListSort {
  if (!value || value === "newest") {
    return "newest";
  }

  if (value === "price_asc" || value === "price_desc") {
    return value;
  }

  throw new ValidationError("sort must be one of: newest, price_asc, price_desc");
}

function parseOptionalQueryParam(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseProductId(idParam: string): number {
  const id = Number.parseInt(idParam, 10);

  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError("invalid product id");
  }

  return id;
}

export function parseProductListFilters(searchParams: URLSearchParams): ProductListFilters {
  return {
    query: parseOptionalQueryParam(searchParams.get("query")),
    category: parseOptionalQueryParam(searchParams.get("category")),
    sort: parseSort(searchParams.get("sort")),
    limit: parseLimit(searchParams.get("limit")),
  };
}

export function parseCreateProductBody(body: unknown): CreateProductInput {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("request body must be an object");
  }

  const payload = body as Record<string, unknown>;

  const quantity =
    payload.quantity === undefined || payload.quantity === null || payload.quantity === ""
      ? 1
      : parseSingleQuantity(payload.quantity);

  const status = parseStatus(payload.status);

  if ((status === "DRAFT" || status === "ACTIVE") && quantity !== 1) {
    throw new ValidationError("DRAFT and ACTIVE products must have quantity 1");
  }

  if (status === "SOLD" && quantity !== 0) {
    throw new ValidationError("SOLD products must have quantity 0");
  }

  const suggestedPriceLowCents = parseOptionalPriceToCents(
    payload.suggestedPriceLow,
    "suggestedPriceLow",
  );
  const suggestedPriceHighCents = parseOptionalPriceToCents(
    payload.suggestedPriceHigh,
    "suggestedPriceHigh",
  );

  if (
    suggestedPriceLowCents !== null &&
    suggestedPriceHighCents !== null &&
    suggestedPriceHighCents < suggestedPriceLowCents
  ) {
    throw new ValidationError(
      "suggestedPriceHigh must be greater than or equal to suggestedPriceLow",
    );
  }

  return {
    name: parseNonEmptyString(payload.name, "name"),
    sku: parseOptionalString(payload.sku, "sku"),
    category: parseOptionalString(payload.category, "category"),
    description: parseOptionalString(payload.description, "description"),
    itemDescription: parseOptionalString(payload.itemDescription, "itemDescription"),
    conditionNote: parseOptionalString(payload.conditionNote, "conditionNote"),
    dimensions: parseOptionalString(payload.dimensions, "dimensions"),
    measurements: parseOptionalString(payload.measurements, "measurements"),
    yearOfPurchase: parseOptionalString(payload.yearOfPurchase, "yearOfPurchase"),
    purchaseDate: parseOptionalDate(payload.purchaseDate, "purchaseDate"),
    storeSource: parseOptionalString(payload.storeSource, "storeSource"),
    receiptPhotoLink: parseOptionalString(payload.receiptPhotoLink, "receiptPhotoLink"),
    receiptDocumentation: parseOptionalString(payload.receiptDocumentation, "receiptDocumentation"),
    cogCents: parseOptionalPriceToCents(payload.cog, "cog"),
    suggestedPriceLowCents,
    suggestedPriceHighCents,
    priceCents: parsePriceToCents(payload.price, "price"),
    finalSalesPriceCents: parseOptionalPriceToCents(payload.finalSalesPrice, "finalSalesPrice"),
    shippingCents: parseOptionalPriceToCents(payload.shipping, "shipping"),
    taxesCents: parseOptionalPriceToCents(payload.taxes, "taxes"),
    imageLink: parseOptionalString(payload.imageLink, "imageLink"),
    sellSiteLocation: parseOptionalString(payload.sellSiteLocation, "sellSiteLocation"),
    shipDate: parseOptionalDate(payload.shipDate, "shipDate"),
    status,
    quantity,
    weightLbs: parseOptionalPositiveNumber(payload.weightLbs, "weightLbs"),
  };
}

export function parseUpdateProductBody(body: unknown): UpdateProductInput {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("request body must be an object");
  }

  const payload = body as Record<string, unknown>;
  const result: UpdateProductInput = {};

  if (payload.name !== undefined) result.name = parseNonEmptyString(payload.name, "name");
  if (payload.sku !== undefined) result.sku = parseOptionalString(payload.sku, "sku");
  if (payload.category !== undefined) result.category = parseOptionalString(payload.category, "category");
  if (payload.description !== undefined) result.description = parseOptionalString(payload.description, "description");
  if (payload.itemDescription !== undefined) result.itemDescription = parseOptionalString(payload.itemDescription, "itemDescription");
  if (payload.conditionNote !== undefined) result.conditionNote = parseOptionalString(payload.conditionNote, "conditionNote");
  if (payload.dimensions !== undefined) result.dimensions = parseOptionalString(payload.dimensions, "dimensions");
  if (payload.measurements !== undefined) result.measurements = parseOptionalString(payload.measurements, "measurements");
  if (payload.yearOfPurchase !== undefined) result.yearOfPurchase = parseOptionalString(payload.yearOfPurchase, "yearOfPurchase");
  if (payload.purchaseDate !== undefined) result.purchaseDate = parseOptionalDate(payload.purchaseDate, "purchaseDate");
  if (payload.storeSource !== undefined) result.storeSource = parseOptionalString(payload.storeSource, "storeSource");
  if (payload.receiptPhotoLink !== undefined) result.receiptPhotoLink = parseOptionalString(payload.receiptPhotoLink, "receiptPhotoLink");
  if (payload.receiptDocumentation !== undefined) result.receiptDocumentation = parseOptionalString(payload.receiptDocumentation, "receiptDocumentation");
  if (payload.cog !== undefined) result.cogCents = parseOptionalPriceToCents(payload.cog, "cog");
  if (payload.suggestedPriceLow !== undefined) result.suggestedPriceLowCents = parseOptionalPriceToCents(payload.suggestedPriceLow, "suggestedPriceLow");
  if (payload.suggestedPriceHigh !== undefined) result.suggestedPriceHighCents = parseOptionalPriceToCents(payload.suggestedPriceHigh, "suggestedPriceHigh");
  if (payload.price !== undefined) result.priceCents = parsePriceToCents(payload.price, "price");
  if (payload.finalSalesPrice !== undefined) result.finalSalesPriceCents = parseOptionalPriceToCents(payload.finalSalesPrice, "finalSalesPrice");
  if (payload.shipping !== undefined) result.shippingCents = parseOptionalPriceToCents(payload.shipping, "shipping");
  if (payload.taxes !== undefined) result.taxesCents = parseOptionalPriceToCents(payload.taxes, "taxes");
  if (payload.imageLink !== undefined) result.imageLink = parseOptionalString(payload.imageLink, "imageLink");
  if (payload.sellSiteLocation !== undefined) result.sellSiteLocation = parseOptionalString(payload.sellSiteLocation, "sellSiteLocation");
  if (payload.shipDate !== undefined) result.shipDate = parseOptionalDate(payload.shipDate, "shipDate");
  if (payload.weightLbs !== undefined) result.weightLbs = parseOptionalPositiveNumber(payload.weightLbs, "weightLbs");

  const low = result.suggestedPriceLowCents;
  const high = result.suggestedPriceHighCents;
  if (low !== undefined && high !== undefined && low !== null && high !== null && high < low) {
    throw new ValidationError(
      "suggestedPriceHigh must be greater than or equal to suggestedPriceLow",
    );
  }

  return result;
}

export function parseAddProductImageBody(body: unknown): AddProductImageInput {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("request body must be an object");
  }

  const payload = body as Record<string, unknown>;

  const imageUrl = parseNonEmptyString(payload.imageUrl, "imageUrl");

  let altText: string | null = null;
  if (payload.altText !== undefined && payload.altText !== null) {
    if (typeof payload.altText !== "string") {
      throw new ValidationError("altText must be a string");
    }

    const trimmed = payload.altText.trim();
    altText = trimmed.length > 0 ? trimmed : null;
  }

  return { imageUrl, altText };
}

export function parseCheckoutBody(body: unknown): CheckoutInput {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("request body must be an object");
  }

  const payload = body as Record<string, unknown>;
  const raw = payload.productId;

  const productId =
    typeof raw === "string" ? Number.parseInt(raw, 10) : typeof raw === "number" ? raw : Number.NaN;

  if (!Number.isInteger(productId) || productId <= 0) {
    throw new ValidationError("productId must be a positive integer");
  }

  return { productId };
}
