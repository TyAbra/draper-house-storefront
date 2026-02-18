import type { AdminProduct } from "@/app/admin/actions";

export default async function AdminMarketplacePage() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/products?sort=newest&limit=48`, { cache: "no-store" });
  const data = (await response.json()) as { products?: AdminProduct[]; error?: string };

  return (
    <main className="mx-auto max-w-xl px-4 py-5">
      <h2 className="dh-serif text-4xl tracking-tight text-[var(--dh-wood)]">Live Marketplace Preview</h2>
      <p className="mt-2 text-base text-[rgba(110,123,85,0.9)]">Shows ACTIVE products from the public marketplace API.</p>

      {data.error && (
        <p className="mt-4 rounded-2xl bg-[rgba(195,107,78,0.16)] px-4 py-3 text-base text-[var(--dh-terracotta)]">{data.error}</p>
      )}

      <div className="mt-6 space-y-4">
        {(data.products ?? []).map((product) => (
          <article key={product.id} className="rounded-2xl border border-[rgba(176,141,87,0.2)] bg-[rgba(255,255,255,0.72)] p-5">
            <p className="text-xs text-[rgba(110,123,85,0.8)]">{product.category ?? "Uncategorized"}</p>
            <h3 className="dh-serif mt-1 text-xl leading-snug text-[var(--dh-wood)]">{product.name}</h3>
            <p className="mt-2 line-clamp-3 text-sm text-[rgba(110,123,85,0.9)]">{product.description ?? "No description"}</p>
            <p className="mt-3 text-sm font-medium text-[var(--dh-walnut)]">
              ${(product.priceCents / 100).toFixed(2)} {product.currency}
            </p>
            <p className="mt-1 text-xs text-[rgba(110,123,85,0.8)]">SKU: {product.sku ?? "-"}</p>
          </article>
        ))}
      </div>

      {(data.products ?? []).length === 0 && !data.error && (
        <p className="mt-6 text-sm text-[rgba(110,123,85,0.9)]">No active products yet.</p>
      )}
    </main>
  );
}
