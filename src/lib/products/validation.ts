export type CreateProductInput = {
  name: string;
  description: string | null;
  priceCents: number;
  quantity: 0 | 1;
};

export type AddProductImageInput = {
  imageUrl: string;
  altText: string | null;
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

function parseOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError("description must be a string");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePriceToCents(value: unknown): number {
  const raw =
    typeof value === "string"
      ? Number.parseFloat(value)
      : typeof value === "number"
        ? value
        : Number.NaN;

  if (!Number.isFinite(raw) || raw < 0) {
    throw new ValidationError("price must be a non-negative number");
  }

  return Math.round(raw * 100);
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

export function parseProductId(idParam: string): number {
  const id = Number.parseInt(idParam, 10);

  if (!Number.isInteger(id) || id <= 0) {
    throw new ValidationError("invalid product id");
  }

  return id;
}

export function parseCreateProductBody(body: unknown): CreateProductInput {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("request body must be an object");
  }

  const payload = body as Record<string, unknown>;

  return {
    name: parseNonEmptyString(payload.name, "name"),
    description: parseOptionalString(payload.description),
    priceCents: parsePriceToCents(payload.price),
    quantity: parseSingleQuantity(payload.quantity),
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
