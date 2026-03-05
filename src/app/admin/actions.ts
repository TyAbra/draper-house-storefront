"use server";

import { revalidatePath } from "next/cache";

export type AdminProduct = {
  id: number;
  slug: string;
  sku: string | null;
  name: string;
  description: string | null;
  category: string | null;
  priceCents: number;
  currency: string;
  status: "DRAFT" | "ACTIVE" | "SOLD";
  primaryImageUrl: string | null;
};

export type AdminProductImage = {
  id: number;
  imageUrl: string;
  altText: string | null;
  position: number;
};

export type AdminProductDetail = {
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
  status: "DRAFT" | "ACTIVE" | "SOLD";
  inventoryQuantity: 0 | 1;
  publishedAt: string | null;
  soldAt: string | null;
  images: AdminProductImage[];
};

export type AdminCreateProductState = {
  error: string | null;
  createdProduct: unknown | null;
};

export type CreateInventoryItemState = {
  error: string | null;
  warning: string | null;
  createdProduct: AdminProductDetail | null;
};

export type ImportCsvState = {
  error: string | null;
  result: {
    totalRows: number;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    errorRows: Array<{ rowNumber: number; reason: string }>;
    strategy: string;
  } | null;
};

const INITIAL_CREATE_STATE: AdminCreateProductState = {
  error: null,
  createdProduct: null,
};

const INITIAL_IMPORT_STATE: ImportCsvState = {
  error: null,
  result: null,
};

const INITIAL_INVENTORY_STATE: CreateInventoryItemState = {
  error: null,
  warning: null,
  createdProduct: null,
};

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function getAdminToken(): string {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    throw new Error("ADMIN_TOKEN is not configured");
  }

  return token;
}

function readFormString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function isFileEntry(value: FormDataEntryValue): value is File {
  return value instanceof File;
}

function parseProductId(value: unknown): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const maybeId = (value as { id?: unknown }).id;

  if (typeof maybeId === "number") {
    return Number.isFinite(maybeId) && Number.isInteger(maybeId) && maybeId > 0 ? maybeId : null;
  }

  if (typeof maybeId === "string") {
    const parsed = Number.parseInt(maybeId, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  if (typeof maybeId === "bigint") {
    const asNumber = Number(maybeId);
    return Number.isSafeInteger(asNumber) && asNumber > 0 ? asNumber : null;
  }

  return null;
}

async function callAdminApi(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();

  return fetch(`${APP_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
}

async function callPublicApi(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${APP_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
  });
}

async function uploadImageFile(file: File): Promise<{ imageUrl: string | null; error: string | null }> {
  const uploadForm = new FormData();
  uploadForm.set("file", file, file.name);

  const response = await callAdminApi("/api/admin/uploads/images", {
    method: "POST",
    body: uploadForm,
  });

  const data = (await response.json()) as { imageUrl?: string; error?: string };

  if (!response.ok || typeof data.imageUrl !== "string") {
    return {
      imageUrl: null,
      error: data.error ?? "Failed to upload image",
    };
  }

  return {
    imageUrl: data.imageUrl,
    error: null,
  };
}

async function attachImageToProduct(
  productId: number,
  imageUrl: string,
  altText: string,
): Promise<string | null> {
  const response = await callAdminApi(`/api/products/${productId}/images`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      imageUrl,
      altText,
    }),
  });

  if (response.ok) {
    return null;
  }

  const data = (await response.json()) as { error?: string };
  return data.error ?? "Failed to attach image";
}

export async function listAdminProductsAction(): Promise<{
  products: AdminProduct[];
  error: string | null;
}> {
  try {
    const response = await callAdminApi("/api/admin/products?sort=newest&limit=100");
    const data = (await response.json()) as { products?: AdminProduct[]; error?: string };

    if (!response.ok) {
      return { products: [], error: data.error ?? "Failed to load inventory" };
    }

    return { products: data.products ?? [], error: null };
  } catch (error) {
    return {
      products: [],
      error: error instanceof Error ? error.message : "Failed to load inventory",
    };
  }
}

export async function getAdminProductDetailAction(productId: number): Promise<{
  product: AdminProductDetail | null;
  error: string | null;
}> {
  if (!Number.isInteger(productId) || productId <= 0) {
    return { product: null, error: "Invalid product id" };
  }

  try {
    const response = await callPublicApi(`/api/products/${productId}`);
    const data = (await response.json()) as { product?: AdminProductDetail; error?: string };

    if (!response.ok) {
      return {
        product: null,
        error: data.error ?? "Failed to load item",
      };
    }

    return {
      product: data.product ?? null,
      error: null,
    };
  } catch (error) {
    return {
      product: null,
      error: error instanceof Error ? error.message : "Failed to load item",
    };
  }
}

export async function createAdminProductAction(
  prevState: AdminCreateProductState = INITIAL_CREATE_STATE,
  formData: FormData,
): Promise<AdminCreateProductState> {
  void prevState;

  try {
    const response = await callAdminApi("/api/admin/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        price: String(formData.get("price") ?? ""),
        quantity: String(formData.get("quantity") ?? "1"),
        status: String(formData.get("status") ?? "DRAFT"),
        sku: String(formData.get("sku") ?? ""),
        category: String(formData.get("category") ?? ""),
        conditionNote: String(formData.get("conditionNote") ?? ""),
        dimensions: String(formData.get("dimensions") ?? ""),
        weightLbs: String(formData.get("weightLbs") ?? ""),
        suggestedPriceLow: String(formData.get("suggestedPriceLow") ?? ""),
        suggestedPriceHigh: String(formData.get("suggestedPriceHigh") ?? ""),
      }),
    });

    const data = (await response.json()) as { product?: unknown; error?: string };

    if (!response.ok) {
      return { error: data.error ?? "Failed to create product", createdProduct: null };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/marketplace");

    return { error: null, createdProduct: data.product ?? null };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create product",
      createdProduct: null,
    };
  }
}

export async function createInventoryItemAction(
  prevState: CreateInventoryItemState = INITIAL_INVENTORY_STATE,
  formData: FormData,
): Promise<CreateInventoryItemState> {
  void prevState;

  const intent = readFormString(formData, "intent") === "ready" ? "ready" : "draft";
  const photoFiles = formData
    .getAll("photos")
    .filter(isFileEntry)
    .filter((file) => file.size > 0);

  if (intent === "ready" && photoFiles.length === 0) {
    return {
      error: "Save Ready requires at least one photo.",
      warning: null,
      createdProduct: null,
    };
  }

  try {
    const createResponse = await callAdminApi("/api/admin/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: readFormString(formData, "name"),
        description: readFormString(formData, "description"),
        price: readFormString(formData, "price"),
        quantity: "1",
        status: "DRAFT",
        sku: readFormString(formData, "sku"),
        category: readFormString(formData, "category"),
        conditionNote: readFormString(formData, "conditionNote"),
        dimensions: readFormString(formData, "dimensions"),
        weightLbs: readFormString(formData, "weightLbs"),
        suggestedPriceLow: readFormString(formData, "suggestedPriceLow"),
        suggestedPriceHigh: readFormString(formData, "suggestedPriceHigh"),
      }),
    });

    const createData = (await createResponse.json()) as { product?: unknown; error?: string };

    if (!createResponse.ok) {
      return {
        error: createData.error ?? "Failed to create item",
        warning: null,
        createdProduct: null,
      };
    }

    const productId = parseProductId(createData.product);

    if (!productId) {
      return {
        error: "Item created but response was missing product id",
        warning: null,
        createdProduct: null,
      };
    }

    const uploadErrors: string[] = [];

    for (const file of photoFiles) {
      const uploadResult = await uploadImageFile(file);

      if (!uploadResult.imageUrl) {
        uploadErrors.push(`${file.name}: ${uploadResult.error ?? "Upload failed"}`);
        continue;
      }

      const attachError = await attachImageToProduct(productId, uploadResult.imageUrl, readFormString(formData, "name"));
      if (attachError) {
        uploadErrors.push(`${file.name}: ${attachError}`);
      }
    }

    const detailResult = await getAdminProductDetailAction(productId);

    revalidatePath("/admin");
    revalidatePath("/admin/items/new");
    revalidatePath(`/admin/items/${productId}`);
    revalidatePath("/admin/marketplace");

    return {
      error: detailResult.error,
      warning: uploadErrors.length > 0 ? uploadErrors.join("; ") : null,
      createdProduct: detailResult.product,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to create item",
      warning: null,
      createdProduct: null,
    };
  }
}

export async function publishProductAction(productId: number): Promise<{ error: string | null }> {
  try {
    const response = await callAdminApi(`/api/admin/products/${productId}/publish`, {
      method: "PATCH",
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      return { error: data.error ?? "Failed to publish product" };
    }

    revalidatePath("/admin");
    revalidatePath(`/admin/items/${productId}`);
    revalidatePath("/admin/marketplace");

    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to publish product" };
  }
}

export async function unpublishProductAction(productId: number): Promise<{ error: string | null }> {
  try {
    const response = await callAdminApi(`/api/admin/products/${productId}/unpublish`, {
      method: "PATCH",
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      return { error: data.error ?? "Failed to unpublish product" };
    }

    revalidatePath("/admin");
    revalidatePath(`/admin/items/${productId}`);
    revalidatePath("/admin/marketplace");

    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to unpublish product" };
  }
}

export async function importCsvAction(
  prevState: ImportCsvState = INITIAL_IMPORT_STATE,
  formData: FormData,
): Promise<ImportCsvState> {
  void prevState;

  try {
    const response = await callAdminApi("/api/admin/products/import-csv", {
      method: "POST",
      body: formData,
    });

    const data = (await response.json()) as ImportCsvState["result"] & { error?: string };

    if (!response.ok) {
      return {
        error: data?.error ?? "CSV import failed",
        result: null,
      };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/marketplace");

    return {
      error: null,
      result: {
        totalRows: data?.totalRows ?? 0,
        createdCount: data?.createdCount ?? 0,
        updatedCount: data?.updatedCount ?? 0,
        skippedCount: data?.skippedCount ?? 0,
        errorRows: data?.errorRows ?? [],
        strategy: data?.strategy ?? "",
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "CSV import failed",
      result: null,
    };
  }
}
