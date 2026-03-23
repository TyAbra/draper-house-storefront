"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { createInventoryItemAction, getNextSkuAction, type CreateInventoryItemState } from "@/app/admin/actions";

const CONDITIONS = ["Excellent", "Very Good", "Good", "Fair", "Poor", "As-Is"] as const;

const CATEGORIES = [
  "Furniture",
  "Art & Prints",
  "Ceramics & Pottery",
  "Glass & Crystal",
  "Jewelry & Accessories",
  "Lighting",
  "Mirrors",
  "Rugs & Textiles",
  "Silver & Metalwork",
  "Clocks & Watches",
  "Books & Ephemera",
  "Kitchenware",
  "Décor & Accessories",
  "Other",
] as const;

const INITIAL_STATE: CreateInventoryItemState = {
  error: null,
  warning: null,
  createdProduct: null,
};

type LocalPhoto = { id: string; file: File; previewUrl: string };

function buildPhotoId(file: File): string {
  return `${file.name}-${file.lastModified}-${file.size}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function NewItemClient() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [autoSku, setAutoSku] = useState<string>("");
  const [state, formAction, isPending] = useActionState(createInventoryItemAction, INITIAL_STATE);

  useEffect(() => {
    return () => { for (const p of photos) URL.revokeObjectURL(p.previewUrl); };
  }, [photos]);

  useEffect(() => {
    getNextSkuAction().then(({ sku }) => { if (sku) setAutoSku(sku); });
  }, []);

  const createdId = useMemo(() => state.createdProduct?.id ?? null, [state.createdProduct]);

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const next: LocalPhoto[] = Array.from(fileList)
      .filter((f) => f.size > 0)
      .map((f) => ({ id: buildPhotoId(f), file: f, previewUrl: URL.createObjectURL(f) }));
    if (next.length > 0) setPhotos((prev) => [...prev, ...next]);
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const t = prev.find((p) => p.id === id);
      if (t) URL.revokeObjectURL(t.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  const inputClass =
    "w-full rounded-xl border border-[rgba(176,141,87,0.3)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-base text-[var(--dh-wood)] outline-none focus:ring-2 focus:ring-[var(--dh-walnut)]";
  const labelClass = "block text-sm font-medium text-[var(--dh-wood)]";
  const sectionHeadClass = "text-sm font-semibold uppercase tracking-wide text-[var(--dh-olive)]";

  return (
    <section className="space-y-6 pb-24">
      <header className="space-y-2">
        <h2 className="dh-serif text-4xl tracking-tight text-[var(--dh-wood)]">Add Item</h2>
        <p className="text-base text-[rgba(110,123,85,0.9)]">
          Fill in what you know — everything is editable later.
        </p>
      </header>

      <form
        action={async (formData) => {
          for (const photo of photos) formData.append("photos", photo.file, photo.file.name);
          await formAction(formData);
        }}
        className="space-y-6"
      >
        {/* ── Photos ─────────────────────────────────────────────── */}
        <section className="space-y-3 rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
          <h3 className={sectionHeadClass}>Photos</h3>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => cameraInputRef.current?.click()}
              className="rounded-full bg-[var(--dh-walnut)] px-3 py-4 text-base font-medium text-white transition hover:bg-[var(--dh-wood)]">
              Take Photo
            </button>
            <button type="button" onClick={() => libraryInputRef.current?.click()}
              className="rounded-full bg-[rgba(176,141,87,0.2)] px-3 py-4 text-base font-medium text-[var(--dh-wood)]">
              Upload from Library
            </button>
          </div>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" multiple
            className="hidden" onChange={(e) => { addFiles(e.currentTarget.files); e.currentTarget.value = ""; }} />
          <input ref={libraryInputRef} type="file" accept="image/*" multiple
            className="hidden" onChange={(e) => { addFiles(e.currentTarget.files); e.currentTarget.value = ""; }} />
          {photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((photo) => (
                <div key={photo.id} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#EDE7DB]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.previewUrl} alt={photo.file.name} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removePhoto(photo.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white">✕</button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Identity ───────────────────────────────────────────── */}
        <section className="space-y-4 rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
          <h3 className={sectionHeadClass}>Identity</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>SKU<input name="sku" type="text" value={autoSku} onChange={(e) => setAutoSku(e.target.value)} className={`mt-1 ${inputClass}`} /></label>
            <label className={labelClass}>Year of Purchase
              <input name="yearOfPurchase" type="text" placeholder="e.g. 2023" className={`mt-1 ${inputClass}`} />
            </label>
          </div>
          <label className={labelClass}>Item Name *
            <input name="name" type="text" required className={`mt-1 ${inputClass}`} />
          </label>
          <label className={labelClass}>Product Category
            <select name="category" className={`mt-1 ${inputClass}`}>
              <option value="">— Select —</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </section>

        {/* ── Descriptions ───────────────────────────────────────── */}
        <section className="space-y-4 rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
          <h3 className={sectionHeadClass}>Descriptions</h3>
          <label className={labelClass}>Item Description (internal notes)
            <textarea name="itemDescription" rows={3} className={`mt-1 ${inputClass}`} />
          </label>
          <label className={labelClass}>Full Product Description (for listing)
            <textarea name="description" rows={4} className={`mt-1 ${inputClass}`} />
          </label>
        </section>

        {/* ── Condition & Physical ────────────────────────────────── */}
        <section className="space-y-4 rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
          <h3 className={sectionHeadClass}>Condition &amp; Physical</h3>
          <label className={labelClass}>Condition
            <select name="conditionNote" className={`mt-1 ${inputClass}`}>
              <option value="">— Select —</option>
              {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>Dimensions
              <input name="dimensions" type="text" placeholder='24"W × 36"H' className={`mt-1 ${inputClass}`} />
            </label>
            <label className={labelClass}>Measurements
              <input name="measurements" type="text" className={`mt-1 ${inputClass}`} />
            </label>
          </div>
        </section>

        {/* ── Acquisition ────────────────────────────────────────── */}
        <section className="space-y-4 rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
          <h3 className={sectionHeadClass}>Acquisition</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>Purchase Date
              <input name="purchaseDate" type="date" className={`mt-1 ${inputClass}`} />
            </label>
            <label className={labelClass}>Store / Source
              <input name="storeSource" type="text" className={`mt-1 ${inputClass}`} />
            </label>
          </div>
          <label className={labelClass}>Receipt Photo Link
            <input name="receiptPhotoLink" type="url" placeholder="https://…" className={`mt-1 ${inputClass}`} />
          </label>
          <label className={labelClass}>Receipt Documentation
            <textarea name="receiptDocumentation" rows={2} className={`mt-1 ${inputClass}`} />
          </label>
        </section>

        {/* ── Pricing & Financials ────────────────────────────────── */}
        <section className="space-y-4 rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
          <h3 className={sectionHeadClass}>Pricing &amp; Financials</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>COG ($)
              <input name="cog" type="number" step="0.01" min="0" placeholder="0.00" className={`mt-1 ${inputClass}`} />
            </label>
            <label className={labelClass}>Listing Price ($)
              <input name="price" type="number" step="0.01" min="0" placeholder="0.00" defaultValue="0" className={`mt-1 ${inputClass}`} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>Price Min ($)
              <input name="suggestedPriceLow" type="number" step="0.01" min="0" placeholder="0.00" className={`mt-1 ${inputClass}`} />
            </label>
            <label className={labelClass}>Price Max ($)
              <input name="suggestedPriceHigh" type="number" step="0.01" min="0" placeholder="0.00" className={`mt-1 ${inputClass}`} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>Final Sales Price ($)
              <input name="finalSalesPrice" type="number" step="0.01" min="0" placeholder="0.00" className={`mt-1 ${inputClass}`} />
            </label>
            <label className={labelClass}>Shipping ($)
              <input name="shipping" type="number" step="0.01" min="0" placeholder="0.00" className={`mt-1 ${inputClass}`} />
            </label>
          </div>
          <label className={labelClass}>Taxes ($)
            <input name="taxes" type="number" step="0.01" min="0" placeholder="0.00" className={`mt-1 ${inputClass}`} />
          </label>
        </section>

        {/* ── Media & Logistics ──────────────────────────────────── */}
        <section className="space-y-4 rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
          <h3 className={sectionHeadClass}>Media &amp; Logistics</h3>
          <label className={labelClass}>Image Link
            <input name="imageLink" type="url" placeholder="https://…" className={`mt-1 ${inputClass}`} />
          </label>
          <label className={labelClass}>Sell Site Location
            <input name="sellSiteLocation" type="text" placeholder="e.g. eBay, Etsy, Chairish" className={`mt-1 ${inputClass}`} />
          </label>
          <label className={labelClass}>Ship Date
            <input name="shipDate" type="date" className={`mt-1 ${inputClass}`} />
          </label>
        </section>

        {/* ── Action Buttons ──────────────────────────────────────── */}
        <div className="sticky bottom-20 z-10 flex gap-2 bg-[rgba(245,241,232,0.95)] pt-2 backdrop-blur">
          <button type="button" onClick={() => router.back()} disabled={isPending}
            className="rounded-full border border-[rgba(176,141,87,0.35)] bg-transparent px-4 py-4 text-base font-medium text-[var(--dh-wood)] disabled:opacity-60">
            Cancel
          </button>
          <button type="submit" name="intent" value="draft" disabled={isPending}
            className="flex-1 rounded-full bg-[rgba(176,141,87,0.2)] px-3 py-4 text-base font-semibold text-[var(--dh-wood)] disabled:opacity-60">
            {isPending ? "Saving…" : "Save Draft"}
          </button>
          <button type="submit" name="intent" value="ready" disabled={isPending}
            className="flex-1 rounded-full bg-[var(--dh-walnut)] px-3 py-4 text-base font-semibold text-white transition hover:bg-[var(--dh-wood)] disabled:opacity-60">
            {isPending ? "Saving…" : "Save Ready"}
          </button>
        </div>
      </form>

      {state.error && (
        <p className="rounded-2xl bg-[rgba(195,107,78,0.16)] px-4 py-3 text-base text-[var(--dh-terracotta)]">
          {state.error}
        </p>
      )}
      {state.warning && (
        <p className="rounded-2xl bg-[rgba(176,141,87,0.2)] px-4 py-3 text-base text-[var(--dh-walnut)]">
          ⚠ {state.warning}
        </p>
      )}
      {createdId && (
        <div className="rounded-2xl bg-[rgba(110,123,85,0.16)] px-4 py-3 text-base text-[var(--dh-olive)]">
          Item saved.{" "}
          <Link href={`/admin/items/${createdId}`} className="font-semibold underline">
            Open item detail
          </Link>
        </div>
      )}
    </section>
  );
}
