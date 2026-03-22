"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import {
  addPhotosAction,
  getAdminProductDetailAction,
  markProductSoldAction,
  publishProductAction,
  unpublishProductAction,
  updateInventoryItemAction,
  type AddPhotosState,
  type AdminProductDetail,
  type UpdateInventoryItemState,
} from "@/app/admin/actions";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITIONS = [
  "Excellent",
  "Very Good",
  "Good",
  "Fair",
  "Poor",
  "As-Is",
] as const;

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

// ─── Types ────────────────────────────────────────────────────────────────────

type DisplayLifecycle = "Draft" | "Ready" | "Listed" | "Sold";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDisplayLifecycle(product: AdminProductDetail): DisplayLifecycle {
  if (product.status === "SOLD") return "Sold";
  if (product.status === "ACTIVE") return "Listed";
  if (product.status === "READY") return "Ready";
  return "Draft";
}

function centsToDisplay(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

function formatMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysInInventory(createdAtIso: string): number {
  return Math.floor((Date.now() - new Date(createdAtIso).getTime()) / 86400000);
}

// ── Calculated financial fields ───────────────────────────────────────────
type FinancialCalcs = {
  midPrice: number | null;
  fees: number | null;
  netProfit: number | null;
  marginPct: number | null;
  roiPct: number | null;
};

function calcFinancials(product: AdminProductDetail): FinancialCalcs {
  const low = product.suggestedPriceLowCents;
  const high = product.suggestedPriceHighCents;
  const midPrice = low !== null && high !== null ? Math.round((low + high) / 2) : null;

  const fsp = product.finalSalesPriceCents;
  const cog = product.cogCents;
  const ship = product.shippingCents ?? 0;
  const taxes = product.taxesCents ?? 0;
  const fees = fsp !== null ? Math.round(fsp * 0.13) : null;
  const netProfit =
    fsp !== null && cog !== null && fees !== null
      ? fsp - cog - fees - ship - taxes
      : null;
  const marginPct =
    netProfit !== null && fsp !== null && fsp > 0 ? (netProfit / fsp) * 100 : null;
  const roiPct =
    netProfit !== null && cog !== null && cog > 0 ? (netProfit / cog) * 100 : null;

  return { midPrice, fees, netProfit, marginPct, roiPct };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LifecycleBadge({ lifecycle }: { lifecycle: DisplayLifecycle }) {
  const className =
    lifecycle === "Listed"
      ? "bg-[rgba(110,123,85,0.2)] text-[var(--dh-olive)]"
      : lifecycle === "Sold"
        ? "bg-[rgba(195,107,78,0.2)] text-[var(--dh-terracotta)]"
        : lifecycle === "Ready"
          ? "bg-[rgba(176,141,87,0.25)] text-[var(--dh-brass)]"
          : "bg-[rgba(176,141,87,0.12)] text-[rgba(176,141,87,0.75)]";
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${className}`}>
      {lifecycle}
    </span>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--dh-brass)]">
      {children}
    </h3>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5">
      <span className="w-44 shrink-0 text-xs text-[rgba(110,123,85,0.65)]">{label}</span>
      <span className="flex-1 text-sm text-[var(--dh-walnut)]">{value ?? "—"}</span>
    </div>
  );
}

function CalcField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[rgba(176,141,87,0.06)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[rgba(110,123,85,0.6)]">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-[var(--dh-walnut)]">{value}</p>
    </div>
  );
}

// ─── Add Photos Form ──────────────────────────────────────────────────────────

const INITIAL_ADD_PHOTOS_STATE: AddPhotosState = { error: null, addedCount: 0 };

function AddPhotosForm({ productId, onAdded }: { productId: number; onAdded: () => void }) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const libraryRef = useRef<HTMLInputElement | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const boundAction = addPhotosAction.bind(null, productId);
  const [state, formAction, isPending] = useActionState(boundAction, INITIAL_ADD_PHOTOS_STATE);

  if (state.addedCount > 0 && !state.error && pendingFiles.length > 0) {
    setPendingFiles([]);
    onAdded();
  }

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const valid = Array.from(fileList).filter((f) => f.size > 0);
    if (valid.length > 0) setPendingFiles((prev) => [...prev, ...valid]);
  }

  return (
    <form
      action={async (fd) => {
        for (const file of pendingFiles) fd.append("photos", file, file.name);
        await formAction(fd);
      }}
      className="space-y-3 rounded-2xl bg-[rgba(255,255,255,0.55)] p-4"
    >
      <h4 className="text-sm font-semibold uppercase tracking-wide text-[var(--dh-olive)]">
        Add Photos
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="rounded-full bg-[var(--dh-walnut)] px-3 py-3 text-sm font-medium text-white transition hover:bg-[var(--dh-wood)]"
        >
          Take Photo
        </button>
        <button
          type="button"
          onClick={() => libraryRef.current?.click()}
          className="rounded-full bg-[rgba(176,141,87,0.2)] px-3 py-3 text-sm font-medium text-[var(--dh-wood)]"
        >
          Choose from Library
        </button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple
        className="hidden" onChange={(e) => { addFiles(e.currentTarget.files); e.currentTarget.value = ""; }} />
      <input ref={libraryRef} type="file" accept="image/*" multiple
        className="hidden" onChange={(e) => { addFiles(e.currentTarget.files); e.currentTarget.value = ""; }} />

      {pendingFiles.length > 0 && (
        <p className="text-xs text-[var(--dh-wood)]">
          {pendingFiles.length} photo{pendingFiles.length !== 1 ? "s" : ""} selected
        </p>
      )}
      {state.error && <p className="text-xs text-[var(--dh-terracotta)]">{state.error}</p>}
      {pendingFiles.length > 0 && (
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-full bg-[var(--dh-walnut)] py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {isPending ? "Uploading…" : `Upload ${pendingFiles.length} Photo${pendingFiles.length !== 1 ? "s" : ""}`}
        </button>
      )}
    </form>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

const INITIAL_UPDATE_STATE: UpdateInventoryItemState = {
  error: null,
  updatedProduct: null,
};

function EditForm({
  product,
  onSaved,
}: {
  product: AdminProductDetail;
  onSaved: (updated: AdminProductDetail) => void;
}) {
  const boundAction = updateInventoryItemAction.bind(null, product.id);
  const [state, formAction, isPending] = useActionState(boundAction, INITIAL_UPDATE_STATE);

  useEffect(() => {
    if (state.updatedProduct && !state.error) {
      onSaved(state.updatedProduct);
    }
  }, [state.updatedProduct, state.error, onSaved]);

  const inputClass =
    "w-full rounded-2xl border border-[rgba(176,141,87,0.25)] bg-white/70 px-4 py-3 text-sm text-[var(--dh-walnut)] outline-none focus:border-[var(--dh-brass)] focus:ring-1 focus:ring-[var(--dh-brass)]";
  const textareaClass = inputClass + " min-h-[90px] resize-y";
  const labelClass = "block mb-1.5 text-xs font-medium text-[rgba(110,123,85,0.8)] uppercase tracking-wide";

  const calc = calcFinancials(product);

  return (
    <form action={formAction} className="space-y-8 pb-10">

      {/* ── Identity ─────────────────────────────────────────────────── */}
      <section>
        <SectionHeader>Identity</SectionHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>SKU</label>
            <input name="sku" defaultValue={product.sku ?? ""} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Year of Purchase</label>
            <input name="yearOfPurchase" defaultValue={product.yearOfPurchase ?? ""}
              className={inputClass} placeholder="e.g. 2023" />
          </div>
        </div>
        <div className="mt-3">
          <label className={labelClass}>Item Name *</label>
          <input name="name" required defaultValue={product.name} className={inputClass} />
        </div>
        <div className="mt-3">
          <label className={labelClass}>Product Category</label>
          <select name="category" defaultValue={product.category ?? ""} className={inputClass}>
            <option value="">— Select category —</option>
            {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            {product.category && !(CANONICAL_CATEGORIES as readonly string[]).includes(product.category) && (
              <option value={product.category}>{product.category}</option>
            )}
          </select>
        </div>
      </section>

      {/* ── Descriptions ─────────────────────────────────────────────── */}
      <section>
        <SectionHeader>Descriptions</SectionHeader>
        <div>
          <label className={labelClass}>Item Description (internal notes)</label>
          <textarea name="itemDescription" defaultValue={product.itemDescription ?? ""}
            className={textareaClass} />
        </div>
        <div className="mt-3">
          <label className={labelClass}>Full Product Description (for listing)</label>
          <textarea name="description" defaultValue={product.description ?? ""}
            className={textareaClass + " min-h-[120px]"} />
        </div>
      </section>

      {/* ── Condition & Physical ─────────────────────────────────────── */}
      <section>
        <SectionHeader>Condition &amp; Physical</SectionHeader>
        <div>
          <label className={labelClass}>Condition</label>
          <select name="conditionNote" defaultValue={product.conditionNote ?? ""} className={inputClass}>
            <option value="">— Select condition —</option>
            {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            {product.conditionNote && !(CONDITIONS as readonly string[]).includes(product.conditionNote) && (
              <option value={product.conditionNote}>{product.conditionNote}</option>
            )}
          </select>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Dimensions</label>
            <input name="dimensions" defaultValue={product.dimensions ?? ""}
              className={inputClass} placeholder='e.g. 24"W × 36"H' />
          </div>
          <div>
            <label className={labelClass}>Measurements</label>
            <input name="measurements" defaultValue={product.measurements ?? ""}
              className={inputClass} placeholder="Additional measurements" />
          </div>
        </div>
      </section>

      {/* ── Acquisition ──────────────────────────────────────────────── */}
      <section>
        <SectionHeader>Acquisition</SectionHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Purchase Date</label>
            <input name="purchaseDate" type="date" defaultValue={product.purchaseDate ?? ""}
              className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Store / Source</label>
            <input name="storeSource" defaultValue={product.storeSource ?? ""}
              className={inputClass} />
          </div>
        </div>
        <div className="mt-3">
          <label className={labelClass}>Receipt Photo Link</label>
          <input name="receiptPhotoLink" type="url" defaultValue={product.receiptPhotoLink ?? ""}
            className={inputClass} placeholder="https://…" />
        </div>
        <div className="mt-3">
          <label className={labelClass}>Receipt Documentation</label>
          <textarea name="receiptDocumentation" defaultValue={product.receiptDocumentation ?? ""}
            className={textareaClass} placeholder="Notes about receipt or purchase documentation" />
        </div>
      </section>

      {/* ── Pricing & Financials ─────────────────────────────────────── */}
      <section>
        <SectionHeader>Pricing &amp; Financials</SectionHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>COG ($)</label>
            <input name="cog" type="number" step="0.01" min="0"
              defaultValue={centsToDisplay(product.cogCents)}
              className={inputClass} placeholder="0.00" />
          </div>
          <div>
            <label className={labelClass}>Listing Price ($)</label>
            <input name="price" type="number" step="0.01" min="0"
              defaultValue={centsToDisplay(product.priceCents)}
              className={inputClass} placeholder="0.00" />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Price Min ($)</label>
            <input name="suggestedPriceLow" type="number" step="0.01" min="0"
              defaultValue={centsToDisplay(product.suggestedPriceLowCents)}
              className={inputClass} placeholder="0.00" />
          </div>
          <div>
            <label className={labelClass}>Price Max ($)</label>
            <input name="suggestedPriceHigh" type="number" step="0.01" min="0"
              defaultValue={centsToDisplay(product.suggestedPriceHighCents)}
              className={inputClass} placeholder="0.00" />
          </div>
        </div>

        {/* Calculated read-only fields */}
        {(calc.midPrice !== null) && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <CalcField label="Mid Price" value={formatMoney(calc.midPrice)} />
            <CalcField
              label="Suggested Price Range"
              value={`${formatMoney(product.suggestedPriceLowCents)} – ${formatMoney(product.suggestedPriceHighCents)}`}
            />
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Final Sales Price ($)</label>
            <input name="finalSalesPrice" type="number" step="0.01" min="0"
              defaultValue={centsToDisplay(product.finalSalesPriceCents)}
              className={inputClass} placeholder="0.00" />
          </div>
          <div>
            <label className={labelClass}>Shipping ($)</label>
            <input name="shipping" type="number" step="0.01" min="0"
              defaultValue={centsToDisplay(product.shippingCents)}
              className={inputClass} placeholder="0.00" />
          </div>
        </div>

        <div className="mt-3">
          <label className={labelClass}>Taxes ($)</label>
          <input name="taxes" type="number" step="0.01" min="0"
            defaultValue={centsToDisplay(product.taxesCents)}
            className={inputClass} placeholder="0.00" />
        </div>

        {/* Calculated outcome fields */}
        {calc.fees !== null && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <CalcField label="Fees (13%)" value={formatMoney(calc.fees)} />
            <CalcField label="Net Profit" value={formatMoney(calc.netProfit)} />
            <CalcField label="Margin %" value={calc.marginPct !== null ? `${calc.marginPct.toFixed(1)}%` : "—"} />
            <CalcField label="ROI %" value={calc.roiPct !== null ? `${calc.roiPct.toFixed(1)}%` : "—"} />
          </div>
        )}
      </section>

      {/* ── Media & Logistics ────────────────────────────────────────── */}
      <section>
        <SectionHeader>Media &amp; Logistics</SectionHeader>
        <div>
          <label className={labelClass}>Image Link</label>
          <input name="imageLink" type="url" defaultValue={product.imageLink ?? ""}
            className={inputClass} placeholder="https://…" />
        </div>
        <div className="mt-3">
          <label className={labelClass}>Sell Site Location</label>
          <input name="sellSiteLocation" defaultValue={product.sellSiteLocation ?? ""}
            className={inputClass} placeholder="e.g. eBay, Etsy, Chairish" />
        </div>
        <div className="mt-3">
          <label className={labelClass}>Ship Date</label>
          <input name="shipDate" type="date" defaultValue={product.shipDate ?? ""}
            className={inputClass} />
        </div>
      </section>

      {/* ── Save ─────────────────────────────────────────────────────── */}
      {state.error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-[var(--dh-walnut)] py-4 text-base font-medium text-white transition hover:bg-[var(--dh-wood)] disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}

// ── Needed for the category select fallback ───────────────────────────────
const CANONICAL_CATEGORIES = CATEGORIES as readonly string[];

// ─── Detail Display View ──────────────────────────────────────────────────────

function DetailDisplay({ product }: { product: AdminProductDetail }) {
  const lifecycle = getDisplayLifecycle(product);
  const days = daysInInventory(product.createdAt);
  const calc = calcFinancials(product);

  return (
    <div className="space-y-6 pb-10">

      {/* ── Identity ─────────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
        <SectionHeader>Identity</SectionHeader>
        <FieldRow label="SKU" value={product.sku} />
        <FieldRow label="Year of Purchase" value={product.yearOfPurchase} />
        <FieldRow label="Item Name" value={product.name} />
        <FieldRow label="Product Category" value={product.category} />
        <FieldRow label="Status" value={<LifecycleBadge lifecycle={lifecycle} />} />
      </section>

      {/* ── Descriptions ─────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
        <SectionHeader>Descriptions</SectionHeader>
        <FieldRow label="Item Description" value={product.itemDescription} />
        <FieldRow label="Full Product Description" value={product.description} />
      </section>

      {/* ── Condition & Physical ─────────────────────────────────────── */}
      <section className="rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
        <SectionHeader>Condition &amp; Physical</SectionHeader>
        <FieldRow label="Condition" value={product.conditionNote} />
        <FieldRow label="Dimensions" value={product.dimensions} />
        <FieldRow label="Measurements" value={product.measurements} />
      </section>

      {/* ── Acquisition ──────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
        <SectionHeader>Acquisition</SectionHeader>
        <FieldRow label="Purchase Date" value={formatDate(product.purchaseDate)} />
        <FieldRow label="Store / Source" value={product.storeSource} />
        <FieldRow label="COG" value={formatMoney(product.cogCents)} />
        <FieldRow label="Receipt Photo Link" value={
          product.receiptPhotoLink
            ? <a href={product.receiptPhotoLink} target="_blank" rel="noreferrer"
                className="truncate text-[var(--dh-wood)] underline">{product.receiptPhotoLink}</a>
            : null
        } />
        <FieldRow label="Receipt Documentation" value={product.receiptDocumentation} />
      </section>

      {/* ── Pricing & Financials ─────────────────────────────────────── */}
      <section className="rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
        <SectionHeader>Pricing &amp; Financials</SectionHeader>
        <FieldRow label="Price Min" value={formatMoney(product.suggestedPriceLowCents)} />
        <FieldRow label="Price Max" value={formatMoney(product.suggestedPriceHighCents)} />
        <FieldRow label="Mid Price" value={formatMoney(calc.midPrice)} />
        <FieldRow label="Suggested Price Range" value={
          product.suggestedPriceLowCents !== null && product.suggestedPriceHighCents !== null
            ? `${formatMoney(product.suggestedPriceLowCents)} – ${formatMoney(product.suggestedPriceHighCents)}`
            : null
        } />
        <FieldRow label="Listing Price" value={formatMoney(product.priceCents)} />
        <FieldRow label="Final Sales Price" value={formatMoney(product.finalSalesPriceCents)} />
        <FieldRow label="Fees (13%)" value={formatMoney(calc.fees)} />
        <FieldRow label="Shipping" value={formatMoney(product.shippingCents)} />
        <FieldRow label="Taxes" value={formatMoney(product.taxesCents)} />
        <FieldRow label="Net Profit" value={formatMoney(calc.netProfit)} />
        <FieldRow label="Margin %" value={calc.marginPct !== null ? `${calc.marginPct.toFixed(1)}%` : null} />
        <FieldRow label="ROI %" value={calc.roiPct !== null ? `${calc.roiPct.toFixed(1)}%` : null} />
      </section>

      {/* ── Media & Logistics ────────────────────────────────────────── */}
      <section className="rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
        <SectionHeader>Media &amp; Logistics</SectionHeader>
        <FieldRow label="Image Link" value={
          product.imageLink
            ? <a href={product.imageLink} target="_blank" rel="noreferrer"
                className="truncate text-[var(--dh-wood)] underline">{product.imageLink}</a>
            : null
        } />
        <FieldRow label="Sell Site Location" value={product.sellSiteLocation} />
        <FieldRow label="Ship Date" value={product.shipDate ? formatDate(product.shipDate) : null} />
      </section>

      {/* ── Inventory Status ─────────────────────────────────────────── */}
      <section className="rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
        <SectionHeader>Inventory Status</SectionHeader>
        <FieldRow label="Qty OH" value={product.inventoryQuantity} />
        <FieldRow label="Days in Inventory" value={`${days} days`} />
        <FieldRow label="Date Sold" value={formatDate(product.soldAt)} />
      </section>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ItemDetailClient({
  initialProduct,
}: {
  initialProduct: AdminProductDetail;
}) {
  const [product, setProduct] = useState<AdminProductDetail>(initialProduct);
  const [view, setView] = useState<"display" | "edit">("display");
  const [isMutating, startMutation] = useTransition();

  const lifecycle = getDisplayLifecycle(product);

  function handleAction(action: () => Promise<{ error: string | null }>) {
    startMutation(async () => {
      const result = await action();
      if (result.error) {
        alert(result.error);
        return;
      }
      // Refresh product state
      const fresh = await getAdminProductDetailAction(product.id);
      if (fresh.product) setProduct(fresh.product);
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-[var(--dh-walnut)]">
            {product.name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <LifecycleBadge lifecycle={lifecycle} />
            {product.sku && (
              <span className="text-xs text-[rgba(110,123,85,0.6)]">#{product.sku}</span>
            )}
          </div>
        </div>
        <button
          onClick={() => setView(view === "edit" ? "display" : "edit")}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
            view === "edit"
              ? "bg-[rgba(176,141,87,0.15)] text-[var(--dh-wood)]"
              : "bg-[var(--dh-walnut)] text-white hover:bg-[var(--dh-wood)]"
          }`}
        >
          {view === "edit" ? "Cancel" : "Edit"}
        </button>
      </div>

      {/* ── Photos ─────────────────────────────────────────────────── */}
      {product.images.length > 0 && (
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {product.images.map((img) => (
            <div
              key={img.id}
              className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-[var(--dh-linen)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.imageUrl}
                alt={img.altText ?? product.name}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Content: Edit Form or Display ──────────────────────────── */}
      {view === "edit" ? (
        <EditForm
          product={product}
          onSaved={(updated) => {
            setProduct(updated);
            setView("display");
          }}
        />
      ) : (
        <>
          <DetailDisplay product={product} />

          {/* ── Add Photos ─────────────────────────────────────────── */}
          {product.status !== "SOLD" && (
            <div className="mb-6">
              <AddPhotosForm
                productId={product.id}
                onAdded={async () => {
                  const fresh = await getAdminProductDetailAction(product.id);
                  if (fresh.product) setProduct(fresh.product);
                }}
              />
            </div>
          )}

          {/* ── Lifecycle Actions ───────────────────────────────────── */}
          {product.status !== "SOLD" && (
            <div className="flex gap-2">
              {(product.status === "DRAFT" || product.status === "READY") && (
                <button
                  onClick={() => handleAction(() => publishProductAction(product.id))}
                  disabled={isMutating}
                  className="flex-1 rounded-full bg-[var(--dh-walnut)] py-3.5 text-sm font-medium text-white transition hover:bg-[var(--dh-wood)] disabled:opacity-60"
                >
                  Mark Listed
                </button>
              )}
              {product.status === "ACTIVE" && (
                <button
                  onClick={() => handleAction(() => unpublishProductAction(product.id))}
                  disabled={isMutating}
                  className="flex-1 rounded-full border border-[rgba(176,141,87,0.35)] py-3.5 text-sm font-medium text-[var(--dh-wood)] disabled:opacity-60"
                >
                  Move to Draft
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm(`Mark "${product.name}" as sold?`)) {
                    handleAction(() => markProductSoldAction(product.id));
                  }
                }}
                disabled={isMutating}
                className="flex-1 rounded-full border border-[rgba(195,107,78,0.35)] py-3.5 text-sm font-medium text-[var(--dh-terracotta)] disabled:opacity-60"
              >
                Mark Sold
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
