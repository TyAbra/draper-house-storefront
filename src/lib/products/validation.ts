export type ProductStatus = "DRAFT" | "ACTIVE" | "SOLD";

export type CreateProductInput = {
  name: string;
  description: string | null;
  priceCents: number;
  quantity: 0 | 1;
  status: ProductStatus;
  sku: string | null;
  category: string | null;
  conditionNote: string | null;
  dimensions: string | null;
  weightLbs: number | null;
  suggestedPriceLowCents: number | null;
  suggestedPriceHighCents: number | null;
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
  limit: number;
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

  if (value === "DRAFT" || value === "ACTIVE" || value === "SOLD") {
    return value;
  }

  throw new ValidationError("status must be one of: DRAFT, ACTIVE, SOLD");
}

function parseLimit(value: string | null): number {
  if (!value) {
    return 24;
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
    throw new ValidationError("suggestedPriceHigh must be greater than or equal to suggestedPriceLow");
  }

  return {
    name: parseNonEmptyString(payload.name, "name"),
    description: parseOptionalString(payload.description, "description"),
    priceCents: parsePriceToCents(payload.price, "price"),
    quantity,
    status,
    sku: parseOptionalString(payload.sku, "sku"),
    category: parseOptionalString(payload.category, "category"),
    conditionNote: parseOptionalString(payload.conditionNote, "conditionNote"),
    dimensions: parseOptionalString(payload.dimensions, "dimensions"),
    weightLbs: parseOptionalPositiveNumber(payload.weightLbs, "weightLbs"),
    suggestedPriceLowCents,
    suggestedPriceHighCents,
  };
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
