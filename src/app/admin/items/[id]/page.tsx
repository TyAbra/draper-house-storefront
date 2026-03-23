import ItemDetailClient from "@/app/admin/items/[id]/item-detail-client";
import { getAdminProductDetailAction } from "@/app/admin/actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminItemDetailPage({ params }: PageProps) {
  const { id } = await params;
  const productId = Number.parseInt(id, 10);

  if (!Number.isInteger(productId) || productId <= 0) {
    return (
      <main className="mx-auto max-w-xl px-4 py-5">
        <p className="rounded-2xl bg-[rgba(195,107,78,0.16)] px-4 py-3 text-base text-[var(--dh-terracotta)]">Invalid item id.</p>
      </main>
    );
  }

  const result = await getAdminProductDetailAction(productId);

  if (result.error || !result.product) {
    return (
      <main className="mx-auto max-w-xl px-4 py-5">
        <p className="rounded-2xl bg-[rgba(195,107,78,0.16)] px-4 py-3 text-base text-[var(--dh-terracotta)]">
          {result.error ?? "Item not found."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-5">
      <ItemDetailClient initialProduct={result.product} />
    </main>
  );
}
