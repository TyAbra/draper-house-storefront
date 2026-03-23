"use server";

import { revalidatePath } from "next/cache";

import {
  addProductImage,
  createProduct,
  generateNextSku,
  getProductById,
  listAllProductsForAdmin,
  markProductReady,
  markProductSold,
  publishProduct,
  unpublishProduct,
  updateProduct,
  type ProductDetail,
  type ProductListItem,
} from "@/lib/products/repository";
import {
  parseCreateProductBody,
  parseProductListFilters,
  parseUpdateProductBody,
  ValidationError,
} from "@/lib/products/validation";
import { isS3Configured, uploadImageToS3 } from "@/lib/storage/s3";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// ─── Re-exported types used by UI components ─────────────────────────────────

export type AdminProduct = Omit<ProductListItem, "createdAt" | "soldAt"> & {
  createdAt: string;
  soldAt: string | null;
};

export type AdminProductImage = {
  id: number;
  imageUrl: string;
  altText: string | null;
  position: number;
};

export type AdminProductDetail = Omit<ProductDetail, "images" | "publishedAt" | "soldAt" | "createdAt"> & {
  images: AdminProductImage[];
  // Dates serialised to ISO strings for the client boundary
  publishedAt: string | null;
  soldAt: string | null;
  createdAt: string;
};

export type CreateInventoryItemState = {
  error: string | null;
  warning: string | null;
  createdProduct: AdminProductDetail | null;
};

export type UpdateInventoryItemState = {
  error: string | null;
  updatedProduct: AdminProductDetail | null;
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function serializeDetail(product: ProductDetail): AdminProductDetail {
  return {
    ...product,
    publishedAt: product.publishedAt ? product.publishedAt.toISOString() : null,
    soldAt: product.soldAt ? product.soldAt.toISOString() : null,
    createdAt: product.createdAt.toISOString(),
  };
}

const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function sanitizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

async function uploadImageFile(
  file: File,
): Promise<{ imageUrl: string | null; error: string | null }> {
  const mimeType = file.type.toLowerCase();
  const extension = MIME_EXTENSION[mimeType];

  if (!extension) {
    return { imageUrl: null, error: "unsupported image type" };
  }

  const baseName = sanitizeName(file.name.replace(/\.[^.]+$/, "")) || "photo";
  const fileName = `${Date.now()}-${baseName}-${randomUUID()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (isS3Configured()) {
    const result = await uploadImageToS3(bytes, fileName, mimeType);
    if (!result.success) {
      return { imageUrl: null, error: result.error };
    }
    return { imageUrl: result.imageUrl, error: null };
  }

  // Local fallback (dev only)
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(path.join(uploadsDir, fileName), bytes);
  return { imageUrl: `/uploads/${fileName}`, error: null };
}

function isFileEntry(value: FormDataEntryValue): value is File {
  return value instanceof File;
}

function readFormString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

// ─── Server Actions ───────────────────────────────────────────────────────────

export async function listAdminProductsAction(
  page = 1,
  pageSize = 24,
): Promise<{ products: AdminProduct[]; error: string | null; hasMore: boolean }> {
  try {
    const filters = parseProductListFilters(
      new URLSearchParams({ sort: "newest", limit: String(pageSize + 1) }),
    );

    // Fetch one extra to detect "hasMore"
    const allProducts = await listAllProductsForAdmin({
      ...filters,
      limit: (page * pageSize) + 1,
    });

    const paginated = allProducts.slice((page - 1) * pageSize, page * pageSize);
    const hasMore = allProducts.length > page * pageSize;
    const serialized: AdminProduct[] = paginated.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      soldAt: p.soldAt ? p.soldAt.toISOString() : null,
    }));

    return { products: serialized, error: null, hasMore };
  } catch (error) {
    return {
      products: [],
      error: error instanceof Error ? error.message : "Failed to load inventory",
      hasMore: false,
    };
  }
}

export async function listAllAdminProductsAction(): Promise<{
  products: AdminProduct[];
  error: string | null;
}> {
  try {
    const filters = parseProductListFilters(
      new URLSearchParams({ sort: "newest" }),
    );
    const products = await listAllProductsForAdmin(filters);
    const serialized: AdminProduct[] = products.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      soldAt: p.soldAt ? p.soldAt.toISOString() : null,
    }));
    return { products: serialized, error: null };
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
  const id = Number(productId);
  if (!Number.isInteger(id) || id <= 0) {
    return { product: null, error: "Invalid product id" };
  }
  productId = id;

  try {
    const product = await getProductById(productId);
    if (!product) return { product: null, error: null };
    return { product: serializeDetail(product), error: null };
  } catch (error) {
    return {
      product: null,
      error: error instanceof Error ? error.message : "Failed to load item",
    };
  }
}

export async function createInventoryItemAction(
  prevState: CreateInventoryItemState,
  formData: FormData,
): Promise<CreateInventoryItemState> {
  void prevState;

  const intent = readFormString(formData, "intent") === "ready" ? "ready" : "draft";
  const photoFiles = formData
    .getAll("photos")
    .filter(isFileEntry)
    .filter((file) => file.size > 0);

  try {
    const input = parseCreateProductBody({
      name: readFormString(formData, "name"),
      sku: readFormString(formData, "sku") || null,
      category: readFormString(formData, "category") || null,
      description: readFormString(formData, "description") || null,
      itemDescription: readFormString(formData, "itemDescription") || null,
      conditionNote: readFormString(formData, "conditionNote") || null,
      dimensions: readFormString(formData, "dimensions") || null,
      measurements: readFormString(formData, "measurements") || null,
      weightLbs: readFormString(formData, "weightLbs") || null,
      yearOfPurchase: readFormString(formData, "yearOfPurchase") || null,
      purchaseDate: readFormString(formData, "purchaseDate") || null,
      storeSource: readFormString(formData, "storeSource") || null,
      receiptPhotoLink: readFormString(formData, "receiptPhotoLink") || null,
      receiptDocumentation: readFormString(formData, "receiptDocumentation") || null,
      cog: readFormString(formData, "cog") || null,
      suggestedPriceLow: readFormString(formData, "suggestedPriceLow") || null,
      suggestedPriceHigh: readFormString(formData, "suggestedPriceHigh") || null,
      price: readFormString(formData, "price") || "0",
      finalSalesPrice: readFormString(formData, "finalSalesPrice") || null,
      shipping: readFormString(formData, "shipping") || null,
      taxes: readFormString(formData, "taxes") || null,
      imageLink: readFormString(formData, "imageLink") || null,
      sellSiteLocation: readFormString(formData, "sellSiteLocation") || null,
      shipDate: readFormString(formData, "shipDate") || null,
      quantity: "1",
      status: "DRAFT",
    });

    const created = await createProduct(input);
    const uploadErrors: string[] = [];

    // Upload and attach photos
    for (const file of photoFiles) {
      const uploadResult = await uploadImageFile(file);

      if (!uploadResult.imageUrl) {
        uploadErrors.push(`${file.name}: ${uploadResult.error ?? "Upload failed"}`);
        continue;
      }

      const attached = await addProductImage(created.id, {
        imageUrl: uploadResult.imageUrl,
        altText: input.name,
      });

      if (!attached) {
        uploadErrors.push(`${file.name}: failed to attach to item`);
      }
    }

    // If "Save Ready" intent and at least one photo uploaded, promote to READY
    if (intent === "ready" && uploadErrors.length < photoFiles.length) {
      await markProductReady(created.id);
    }

    const freshProduct = await getProductById(created.id);

    revalidatePath("/admin");
    revalidatePath("/admin/items/new");
    revalidatePath(`/admin/items/${created.id}`);

    return {
      error: null,
      warning: uploadErrors.length > 0 ? uploadErrors.join("; ") : null,
      createdProduct: freshProduct ? serializeDetail(freshProduct) : null,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { error: error.message, warning: null, createdProduct: null };
    }
    return {
      error: error instanceof Error ? error.message : "Failed to create item",
      warning: null,
      createdProduct: null,
    };
  }
}

export async function updateInventoryItemAction(
  productId: number,
  prevState: UpdateInventoryItemState,
  formData: FormData,
): Promise<UpdateInventoryItemState> {
  void prevState;

  const id = Number(productId);
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "Invalid product id", updatedProduct: null };
  }
  // Use coerced id for all downstream calls
  productId = id;

  try {
    const input = parseUpdateProductBody({
      name: readFormString(formData, "name") || undefined,
      sku: readFormString(formData, "sku") || null,
      category: readFormString(formData, "category") || null,
      description: readFormString(formData, "description") || null,
      itemDescription: readFormString(formData, "itemDescription") || null,
      conditionNote: readFormString(formData, "conditionNote") || null,
      dimensions: readFormString(formData, "dimensions") || null,
      measurements: readFormString(formData, "measurements") || null,
      weightLbs: readFormString(formData, "weightLbs") || null,
      yearOfPurchase: readFormString(formData, "yearOfPurchase") || null,
      purchaseDate: readFormString(formData, "purchaseDate") || null,
      storeSource: readFormString(formData, "storeSource") || null,
      receiptPhotoLink: readFormString(formData, "receiptPhotoLink") || null,
      receiptDocumentation: readFormString(formData, "receiptDocumentation") || null,
      cog: readFormString(formData, "cog") || null,
      suggestedPriceLow: readFormString(formData, "suggestedPriceLow") || null,
      suggestedPriceHigh: readFormString(formData, "suggestedPriceHigh") || null,
      price: readFormString(formData, "price") || undefined,
      finalSalesPrice: readFormString(formData, "finalSalesPrice") || null,
      shipping: readFormString(formData, "shipping") || null,
      taxes: readFormString(formData, "taxes") || null,
      imageLink: readFormString(formData, "imageLink") || null,
      sellSiteLocation: readFormString(formData, "sellSiteLocation") || null,
      shipDate: readFormString(formData, "shipDate") || null,
    });

    const updated = await updateProduct(productId, input);
    if (!updated) {
      return { error: "Item not found", updatedProduct: null };
    }

    revalidatePath(`/admin/items/${productId}`);
    revalidatePath("/admin");

    return { error: null, updatedProduct: serializeDetail(updated) };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { error: error.message, updatedProduct: null };
    }
    return {
      error: error instanceof Error ? error.message : "Failed to update item",
      updatedProduct: null,
    };
  }
}

export async function publishProductAction(productId: number): Promise<{ error: string | null }> {
  try {
    const result = await publishProduct(productId);
    if (!result) return { error: "Item could not be published (check status)" };

    revalidatePath("/admin");
    revalidatePath(`/admin/items/${productId}`);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to publish item" };
  }
}

export async function unpublishProductAction(productId: number): Promise<{ error: string | null }> {
  try {
    const result = await unpublishProduct(productId);
    if (!result) return { error: "Item could not be unpublished (check status)" };

    revalidatePath("/admin");
    revalidatePath(`/admin/items/${productId}`);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to unpublish item" };
  }
}

export async function markProductReadyAction(productId: number): Promise<{ error: string | null }> {
  try {
    const result = await markProductReady(productId);
    if (!result) return { error: "Item could not be marked Ready (must be Draft status)" };

    revalidatePath("/admin");
    revalidatePath(`/admin/items/${productId}`);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to mark item Ready" };
  }
}

export async function markProductSoldAction(productId: number): Promise<{ error: string | null }> {
  try {
    const result = await markProductSold(productId);
    if (!result) return { error: "Item could not be marked Sold (already sold?)" };

    revalidatePath("/admin");
    revalidatePath(`/admin/items/${productId}`);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to mark item Sold" };
  }
}

export type AddPhotosState = {
  error: string | null;
  addedCount: number;
};

export async function addPhotosAction(
  productId: number,
  prevState: AddPhotosState,
  formData: FormData,
): Promise<AddPhotosState> {
  void prevState;
  const files = formData.getAll("photos") as File[];

  if (files.length === 0 || (files.length === 1 && files[0].size === 0)) {
    return { error: "No photos selected.", addedCount: 0 };
  }

  let addedCount = 0;
  for (const file of files) {
    if (file.size === 0) continue;
    const uploadResult = await uploadImageFile(file);
    if (!uploadResult.imageUrl) continue;
    await addProductImage(productId, { imageUrl: uploadResult.imageUrl, altText: null });
    addedCount++;
  }

  revalidatePath(`/admin/items/${productId}`);
  return { error: addedCount === 0 ? "No photos could be uploaded." : null, addedCount };
}

export async function importCsvAction(
  prevState: ImportCsvState,
  formData: FormData,
): Promise<ImportCsvState> {
  void prevState;

  // CSV import still hits the API route since it uses the csv.ts parsing module
  const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const token = process.env.ADMIN_TOKEN;

  if (!token) {
    return { error: "ADMIN_TOKEN is not configured", result: null };
  }

  try {
    const response = await fetch(`${APP_BASE_URL}/api/admin/products/import-csv`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
      cache: "no-store",
    });

    const data = (await response.json()) as ImportCsvState["result"] & { error?: string };

    if (!response.ok) {
      return { error: data?.error ?? "CSV import failed", result: null };
    }

    revalidatePath("/admin");

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

export async function getNextSkuAction(): Promise<{ sku: string; error: string | null }> {
  try {
    const sku = await generateNextSku();
    return { sku, error: null };
  } catch (error) {
    return { sku: "", error: error instanceof Error ? error.message : "Failed to generate SKU" };
  }
}
