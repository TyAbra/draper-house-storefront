"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  listAdminProductsAction,
  publishProductAction,
  type AdminProduct,
  unpublishProductAction,
} from "@/app/admin/actions";

type DisplayLifecycle = "Draft" | "Ready" | "Listed" | "Sold";

function getDisplayLifecycle(product: AdminProduct): DisplayLifecycle {
  if (product.status === "SOLD") {
    return "Sold";
  }

  if (product.status === "ACTIVE") {
    return "Listed";
  }

  if (product.primaryImageUrl) {
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

export default function AdminClient({
  initialProducts,
  initialError,
}: {
  initialProducts: AdminProduct[];
  initialError: string | null;
}) {
  const [products, setProducts] = useState<AdminProduct[]>(initialProducts);
  const [listError, setListError] = useState<string | null>(initialError);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isMutating, startTransition] = useTransition();

  async function refreshProducts() {
    const result = await listAdminProductsAction();
    setProducts(result.products);
    setListError(result.error);
  }

  async function handlePublish(productId: number) {
    startTransition(async () => {
      setActionError(null);
      const result = await publishProductAction(productId);
      if (result.error) {
        setActionError(result.error);
        return;
      }

      await refreshProducts();
    });
  }

  async function handleUnpublish(productId: number) {
    startTransition(async () => {
      setActionError(null);
      const result = await unpublishProductAction(productId);
      if (result.error) {
        setActionError(result.error);
        return;
      }

      await refreshProducts();
    });
  }

  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 py-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="dh-serif text-3xl tracking-tight text-[var(--dh-wood)]">Inventory</h2>
          <p className="text-base text-[rgba(110,123,85,0.9)]">Scroll items like a feed. Tap any card to edit and copy listing details.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            startTransition(async () => {
              await refreshProducts();
            });
          }}
          className="shrink-0 pt-1 text-sm text-[var(--dh-olive)] underline underline-offset-4 hover:text-[var(--dh-walnut)] disabled:opacity-50"
          disabled={isMutating}
        >
          Refresh Feed
        </button>
      </header>

      {actionError && (
        <p className="rounded-2xl bg-[rgba(195,107,78,0.16)] px-4 py-3 text-base text-[var(--dh-terracotta)]">{actionError}</p>
      )}

      {listError && (
        <p className="rounded-2xl bg-[rgba(195,107,78,0.16)] px-4 py-3 text-base text-[var(--dh-terracotta)]">{listError}</p>
      )}

      {!listError && products.length === 0 && (
        <div className="space-y-3 rounded-2xl bg-[rgba(255,255,255,0.55)] px-4 py-8 text-center">
          <p className="text-base text-[rgba(110,123,85,0.9)]">No items yet.</p>
          <Link href="/admin/items/new" className="inline-flex rounded-full bg-[var(--dh-walnut)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--dh-wood)]">
            Add your first item
          </Link>
        </div>
      )}

      <div className="space-y-6">
        {products.map((product) => {
          const lifecycle = getDisplayLifecycle(product);

          return (
            <article
              key={product.id}
              className="overflow-hidden rounded-2xl border border-[rgba(176,141,87,0.2)] bg-[rgba(255,255,255,0.72)] shadow-[0_8px_20px_rgba(31,27,22,0.06)] backdrop-blur-sm"
            >
              <Link href={`/admin/items/${product.id}`} className="block">
                <div className="aspect-[4/5] w-full overflow-hidden rounded-2xl bg-[#EDE7DB]">
                  {product.primaryImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.primaryImageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-2xl border border-[rgba(176,141,87,0.15)] bg-white/50">
                      <span className="text-sm text-[rgba(110,123,85,0.7)]">Tap to add photo</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="dh-serif text-lg leading-snug text-[var(--dh-wood)]">{product.name}</h3>
                    <p className="shrink-0 text-base font-medium text-[var(--dh-walnut)]">{formatPrice(product.priceCents)}</p>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <LifecycleBadge lifecycle={lifecycle} />
                    <p className="text-xs text-[rgba(110,123,85,0.8)]">{product.category ?? "Uncategorized"}</p>
                  </div>
                </div>
              </Link>

              <div className="px-4 pb-4">
                {product.status === "DRAFT" && (
                  <button
                    type="button"
                    onClick={() => handlePublish(product.id)}
                    disabled={isMutating}
                    className="w-full rounded-full bg-[var(--dh-walnut)] px-5 py-2.5 text-base font-medium text-white shadow-sm transition hover:bg-[var(--dh-wood)] active:scale-[0.99] disabled:opacity-60"
                  >
                    Mark Listed
                  </button>
                )}

                {product.status === "ACTIVE" && (
                  <button
                    type="button"
                    onClick={() => handleUnpublish(product.id)}
                    disabled={isMutating}
                    className="w-full rounded-full border border-[rgba(176,141,87,0.35)] bg-transparent px-4 py-3 text-base font-medium text-[var(--dh-wood)] disabled:opacity-60"
                  >
                    Move to Draft
                  </button>
                )}

                {product.status === "SOLD" && <span className="text-sm text-[rgba(195,107,78,0.9)]">Sold item</span>}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
