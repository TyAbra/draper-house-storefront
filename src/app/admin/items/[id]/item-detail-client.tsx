"use client";

import { useState, useTransition } from "react";

import {
  getAdminProductDetailAction,
  publishProductAction,
  type AdminProductDetail,
  unpublishProductAction,
} from "@/app/admin/actions";

type DisplayLifecycle = "Draft" | "Ready" | "Listed" | "Sold";

function getDisplayLifecycle(product: AdminProductDetail): DisplayLifecycle {
  if (product.status === "SOLD") {
    return "Sold";
  }

  if (product.status === "ACTIVE") {
    return "Listed";
  }

  if (product.images.length > 0) {
    return "Ready";
  }

  return "Draft";
}

function LifecycleBadge({ lifecycle }: { lifecycle: DisplayLifecycle }) {
  const className =
    lifecycle === "Listed"
      ? "bg-[rgba(110,123,85,0.2)] text-[var(--dh-olive)]"
      : lifecycle === "Sold"
        ? "bg-[rgba(195,107,78,0.2)] text-[var(--dh-terracotta)]"
        : lifecycle === "Ready"
          ? "bg-[rgba(110,123,85,0.2)] text-[var(--dh-olive)]"
          : "bg-[rgba(176,141,87,0.2)] text-[var(--dh-brass)]";

  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${className}`}>{lifecycle}</span>;
}

function formatPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`;
}

function buildDescription(product: AdminProductDetail): string {
  const lines = [
    `Title: ${product.name}`,
    `Price: ${formatPrice(product.priceCents)}`,
    `Category: ${product.category ?? ""}`,
    `Condition: ${product.conditionNote ?? ""}`,
    `Dimensions: ${product.dimensions ?? ""}`,
    `Notes: ${product.description ?? ""}`,
  ];

  return lines.join("\n");
}

function buildTags(product: AdminProductDetail): string {
  const parts = [product.category ?? "", product.conditionNote ?? "", product.sku ?? ""]
    .join(" ")
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length >= 3);

  const unique = Array.from(new Set(parts)).slice(0, 13);
  return unique.join(", ");
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export default function ItemDetailClient({
  productId,
  initialProduct,
  initialError,
}: {
  productId: number;
  initialProduct: AdminProductDetail | null;
  initialError: string | null;
}) {
  const [product, setProduct] = useState<AdminProductDetail | null>(initialProduct);
  const [error, setError] = useState<string | null>(initialError);
  const [copyState, setCopyState] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    const result = await getAdminProductDetailAction(productId);
    setProduct(result.product);
    setError(result.error);
  }

  async function handlePublish() {
    startTransition(async () => {
      const result = await publishProductAction(productId);
      if (result.error) {
        setError(result.error);
        return;
      }

      await refresh();
    });
  }

  async function handleUnpublish() {
    startTransition(async () => {
      const result = await unpublishProductAction(productId);
      if (result.error) {
        setError(result.error);
        return;
      }

      await refresh();
    });
  }

  async function handleCopy(type: "title" | "description" | "tags") {
    if (!product) {
      return;
    }

    const value =
      type === "title" ? product.name : type === "description" ? buildDescription(product) : buildTags(product);

    const copied = await copyToClipboard(value);
    setCopyState(copied ? `${type} copied` : `Could not copy ${type}`);

    setTimeout(() => {
      setCopyState(null);
    }, 1500);
  }

  function downloadAllPhotos() {
    if (!product || product.images.length === 0) {
      return;
    }

    for (const [index, image] of product.images.entries()) {
      const anchor = document.createElement("a");
      anchor.href = image.imageUrl;
      anchor.download = `${product.slug}-photo-${index + 1}`;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  }

  if (error) {
    return <p className="rounded-2xl bg-[rgba(195,107,78,0.16)] px-4 py-3 text-base text-[var(--dh-terracotta)]">{error}</p>;
  }

  if (!product) {
    return <p className="rounded-2xl bg-[rgba(255,255,255,0.55)] px-4 py-3 text-base text-[rgba(110,123,85,0.9)]">Item not found.</p>;
  }

  const lifecycle = getDisplayLifecycle(product);

  return (
    <section className="space-y-6 pb-24">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="dh-serif text-4xl leading-tight tracking-tight text-[var(--dh-wood)]">{product.name}</h2>
          <p className="shrink-0 text-xl font-medium text-[var(--dh-walnut)]">{formatPrice(product.priceCents)}</p>
        </div>

        <div className="flex items-center gap-2">
          <LifecycleBadge lifecycle={lifecycle} />
          <p className="text-xs text-[rgba(110,123,85,0.8)]">SKU: {product.sku ?? "-"}</p>
        </div>
      </header>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--dh-olive)]">Photos</h3>
        {product.images.length === 0 ? (
          <p className="rounded-2xl bg-[rgba(255,255,255,0.55)] px-4 py-3 text-base text-[rgba(110,123,85,0.9)]">No photos uploaded yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex snap-x gap-3 overflow-x-auto pb-1">
              {product.images.map((image) => (
                <div key={image.id} className="h-72 w-80 shrink-0 snap-start overflow-hidden rounded-2xl bg-[#EDE7DB]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.imageUrl} alt={image.altText ?? product.name} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={downloadAllPhotos}
                className="w-full rounded-full bg-[var(--dh-walnut)] px-4 py-3 text-base font-medium text-white transition hover:bg-[var(--dh-wood)]"
              >
                Download/Export Photos
              </button>

              <div className="flex flex-wrap gap-2">
                {product.images.map((image, index) => (
                  <a
                    key={image.id}
                    href={image.imageUrl}
                    download={`${product.slug}-photo-${index + 1}`}
                    className="rounded-full bg-[rgba(176,141,87,0.2)] px-3 py-2 text-xs text-[var(--dh-wood)]"
                  >
                    Photo #{index + 1}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--dh-olive)]">Listing Package</h3>

        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => handleCopy("title")}
            className="w-full rounded-full bg-[rgba(176,141,87,0.2)] px-4 py-3 text-base font-medium text-[var(--dh-wood)]"
          >
            Copy Title
          </button>
          <button
            type="button"
            onClick={() => handleCopy("description")}
            className="w-full rounded-full bg-[rgba(176,141,87,0.2)] px-4 py-3 text-base font-medium text-[var(--dh-wood)]"
          >
            Copy Description
          </button>
          <button
            type="button"
            onClick={() => handleCopy("tags")}
            className="w-full rounded-full bg-[rgba(176,141,87,0.2)] px-4 py-3 text-base font-medium text-[var(--dh-wood)]"
          >
            Copy Tags
          </button>
        </div>

        {copyState && <p className="text-sm text-[rgba(110,123,85,0.9)]">{copyState}</p>}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--dh-olive)]">Status Actions</h3>
        <div className="flex flex-wrap gap-2">
          {product.status === "DRAFT" && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPending}
              className="w-full rounded-full bg-[var(--dh-walnut)] px-4 py-3 text-base font-medium text-white transition hover:bg-[var(--dh-wood)] disabled:opacity-60"
            >
              Mark Listed
            </button>
          )}

          {product.status === "ACTIVE" && (
            <button
              type="button"
              onClick={handleUnpublish}
              disabled={isPending}
              className="w-full rounded-full bg-[rgba(176,141,87,0.2)] px-4 py-3 text-base font-medium text-[var(--dh-wood)] disabled:opacity-60"
            >
              Move to Draft
            </button>
          )}

          {product.status === "SOLD" && <span className="text-base text-[var(--dh-terracotta)]">Sold items cannot be changed.</span>}
        </div>
      </section>

      <section className="space-y-2 rounded-2xl bg-[rgba(255,255,255,0.55)] p-4 text-base text-[var(--dh-wood)]">
        <p>Category: {product.category ?? "-"}</p>
        <p>Condition: {product.conditionNote ?? "-"}</p>
        <p>Dimensions: {product.dimensions ?? "-"}</p>
        <p>Weight (lbs): {product.weightLbs ?? "-"}</p>
        <p>Notes: {product.description ?? "-"}</p>
      </section>
    </section>
  );
}
