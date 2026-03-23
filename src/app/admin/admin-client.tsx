"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import {
  listAllAdminProductsAction,
  markProductSoldAction,
  publishProductAction,
  unpublishProductAction,
  type AdminProduct,
} from "@/app/admin/actions";

const PAGE_SIZE = 24;

// ── Category normalization ──────────────────────────────────────────────────
const CANONICAL_CATEGORIES = [
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

const CATEGORY_KEYWORD_MAP: Record<string, string> = {
  furniture: "Furniture",
  chair: "Furniture",
  table: "Furniture",
  cabinet: "Furniture",
  dresser: "Furniture",
  art: "Art & Prints",
  print: "Art & Prints",
  painting: "Art & Prints",
  photo: "Art & Prints",
  ceramic: "Ceramics & Pottery",
  pottery: "Ceramics & Pottery",
  porcelain: "Ceramics & Pottery",
  glass: "Glass & Crystal",
  crystal: "Glass & Crystal",
  jewelry: "Jewelry & Accessories",
  jewellery: "Jewelry & Accessories",
  accessory: "Jewelry & Accessories",
  accessories: "Jewelry & Accessories",
  lighting: "Lighting",
  lamp: "Lighting",
  chandelier: "Lighting",
  mirror: "Mirrors",
  rug: "Rugs & Textiles",
  textile: "Rugs & Textiles",
  fabric: "Rugs & Textiles",
  silver: "Silver & Metalwork",
  metal: "Silver & Metalwork",
  brass: "Silver & Metalwork",
  bronze: "Silver & Metalwork",
  clock: "Clocks & Watches",
  watch: "Clocks & Watches",
  book: "Books & Ephemera",
  ephemera: "Books & Ephemera",
  paper: "Books & Ephemera",
  kitchen: "Kitchenware",
  decor: "Décor & Accessories",
  "home decor": "Décor & Accessories",
  folk: "Décor & Accessories",
};

function normalizeCategory(raw: string | null): string | null {
  if (!raw) return null;
  if ((CANONICAL_CATEGORIES as readonly string[]).includes(raw)) return raw;
  const lower = raw.toLowerCase();
  for (const [keyword, canonical] of Object.entries(CATEGORY_KEYWORD_MAP)) {
    if (lower.includes(keyword)) return canonical;
  }
  return raw;
}

type StatusFilter = "ALL" | "DRAFT" | "READY" | "ACTIVE" | "SOLD";

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  ALL: "All",
  DRAFT: "Draft",
  READY: "Ready",
  ACTIVE: "Listed",
  SOLD: "Sold",
};

type DisplayLifecycle = "Draft" | "Ready" | "Listed" | "Sold";
type ViewMode = "cards" | "detailed";

function getDisplayLifecycle(product: AdminProduct): DisplayLifecycle {
  if (product.status === "SOLD") return "Sold";
  if (product.status === "ACTIVE") return "Listed";
  if (product.status === "READY") return "Ready";
  return "Draft";
}

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
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${className}`}>{lifecycle}</span>
  );
}

function formatPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`;
}

function formatMoney(cents: number | null | undefined): string | null {
  if (cents === null || cents === undefined) return null;
  return `$${(cents / 100).toFixed(2)}`;
}

function formatMoneyRaw(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

function daysInInventory(createdAtIso: string): number {
  return Math.floor((Date.now() - new Date(createdAtIso).getTime()) / (1000 * 60 * 60 * 24));
}

function formatShipDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function calcNetProfit(product: AdminProduct): { netProfit: number | null; marginPct: number | null; roiPct: number | null; fees: number | null } {
  const fsp = product.finalSalesPriceCents;
  const cog = product.cogCents;
  if (fsp === null || cog === null) return { netProfit: null, marginPct: null, roiPct: null, fees: null };
  const fees = Math.round(fsp * 0.13);
  const ship = product.shippingCents ?? 0;
  const taxes = product.taxesCents ?? 0;
  const netProfit = fsp - cog - fees - ship - taxes;
  const marginPct = fsp > 0 ? (netProfit / fsp) * 100 : null;
  const roiPct = cog > 0 ? (netProfit / cog) * 100 : null;
  return { netProfit, marginPct, roiPct, fees };
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function csvEscape(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportToCSV(products: AdminProduct[], filename: string) {
  const headers = [
    "SKU", "Item Name", "Status", "Category", "Condition", "Dimensions", "Measurements",
    "Year of Purchase", "Purchase Date", "Store/Source",
    "COG", "Price Min", "Price Max", "Mid Price", "Final Sale Price",
    "Fees (13%)", "Shipping", "Taxes", "Net Profit", "Margin %", "ROI %",
    "Item Description", "Sell Site Location", "Image Link",
    "Receipt Photo Link", "Receipt Documentation",
    "Qty OH", "Days in Stock", "Date Sold", "Ship Date",
  ];

  const rows = products.map((p) => {
    const days = daysInInventory(p.createdAt);
    const { netProfit, marginPct, roiPct, fees } = calcNetProfit(p);
    const low = p.suggestedPriceLowCents;
    const high = p.suggestedPriceHighCents;
    const mid = low !== null && high !== null ? ((low + high) / 2 / 100).toFixed(2) : "";

    return [
      p.sku ?? "",
      p.name,
      getDisplayLifecycle(p),
      normalizeCategory(p.category) ?? "",
      p.conditionNote ?? "",
      p.dimensions ?? "",
      p.measurements ?? "",
      p.yearOfPurchase ?? "",
      p.purchaseDate ?? "",
      p.storeSource ?? "",
      formatMoneyRaw(p.cogCents),
      formatMoneyRaw(p.suggestedPriceLowCents),
      formatMoneyRaw(p.suggestedPriceHighCents),
      mid,
      formatMoneyRaw(p.finalSalesPriceCents),
      fees !== null ? (fees / 100).toFixed(2) : "",
      formatMoneyRaw(p.shippingCents),
      formatMoneyRaw(p.taxesCents),
      netProfit !== null ? (netProfit / 100).toFixed(2) : "",
      marginPct !== null ? marginPct.toFixed(1) : "",
      roiPct !== null ? roiPct.toFixed(1) : "",
      p.itemDescription ?? "",
      p.sellSiteLocation ?? "",
      p.imageLink ?? "",
      p.receiptPhotoLink ?? "",
      p.receiptDocumentation ?? "",
      p.inventoryQuantity,
      days,
      p.soldAt ? new Date(p.soldAt).toLocaleDateString("en-US") : "",
      p.shipDate ? formatShipDate(p.shipDate) : "",
    ].map(csvEscape).join(",");
  });

  const csv = [headers.map(csvEscape).join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Detailed List Table ───────────────────────────────────────────────────────

function DetailedList({
  products,
  isMutating,
  handleAction,
}: {
  products: AdminProduct[];
  isMutating: boolean;
  handleAction: (action: () => Promise<{ error: string | null }>) => void;
}) {
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const filename = `draper-house-inventory-${today.replace(/,?\s/g, "-").toLowerCase()}.csv`;

  const thClass = "whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[rgba(110,123,85,0.7)] bg-[rgba(237,231,219,0.9)] border-b border-[rgba(176,141,87,0.2)]";
  const tdClass = "px-3 py-2 text-xs text-[var(--dh-walnut)] align-top whitespace-nowrap";
  const tdWrapClass = "px-3 py-2 text-xs text-[var(--dh-walnut)] align-top max-w-[200px] whitespace-normal break-words";
  const tdMoneyClass = "px-3 py-2 text-xs text-right text-[var(--dh-walnut)] align-top whitespace-nowrap tabular-nums";
  const tdCalcClass = "px-3 py-2 text-xs text-right align-top whitespace-nowrap tabular-nums";

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[rgba(110,123,85,0.7)]">{products.length} item{products.length !== 1 ? "s" : ""}</p>
        <button
          type="button"
          onClick={() => exportToCSV(products, filename)}
          className="flex items-center gap-1.5 rounded-full border border-[rgba(176,141,87,0.4)] bg-[rgba(255,255,255,0.7)] px-4 py-1.5 text-xs font-medium text-[var(--dh-wood)] transition hover:border-[var(--dh-brass)] hover:bg-[rgba(237,231,219,0.6)] hover:text-[var(--dh-brass)]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-[rgba(176,141,87,0.2)] bg-[rgba(255,255,255,0.72)] shadow-[0_2px_8px_rgba(31,27,22,0.05)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={thClass + " sticky left-0 z-10"}>Item Name</th>
              <th className={thClass}>SKU</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Category</th>
              <th className={thClass}>Condition</th>
              <th className={thClass}>Dimensions</th>
              <th className={thClass}>Measurements</th>
              <th className={thClass}>Year</th>
              <th className={thClass}>Purchase Date</th>
              <th className={thClass}>Store / Source</th>
              <th className={thClass + " text-right"}>COG</th>
              <th className={thClass + " text-right"}>Price Min</th>
              <th className={thClass + " text-right"}>Price Max</th>
              <th className={thClass + " text-right"}>Mid Price</th>
              <th className={thClass + " text-right"}>Final Sale</th>
              <th className={thClass + " text-right"}>Fees 13%</th>
              <th className={thClass + " text-right"}>Shipping</th>
              <th className={thClass + " text-right"}>Taxes</th>
              <th className={thClass + " text-right"}>Net Profit</th>
              <th className={thClass + " text-right"}>Margin %</th>
              <th className={thClass + " text-right"}>ROI %</th>
              <th className={thClass}>Item Description</th>
              <th className={thClass}>Sell Site</th>
              <th className={thClass}>Image Link</th>
              <th className={thClass}>Receipt Photo</th>
              <th className={thClass}>Receipt Docs</th>
              <th className={thClass + " text-right"}>Qty OH</th>
              <th className={thClass + " text-right"}>Days</th>
              <th className={thClass}>Date Sold</th>
              <th className={thClass}>Ship Date</th>
              <th className={thClass}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, idx) => {
              const lifecycle = getDisplayLifecycle(product);
              const days = daysInInventory(product.createdAt);
              const { netProfit, marginPct, roiPct, fees } = calcNetProfit(product);
              const low = product.suggestedPriceLowCents;
              const high = product.suggestedPriceHighCents;
              const midPrice = low !== null && high !== null ? (low + high) / 2 : null;

              const rowClass = idx % 2 === 0
                ? "border-b border-[rgba(176,141,87,0.1)]"
                : "border-b border-[rgba(176,141,87,0.1)] bg-[rgba(237,231,219,0.25)]";

              return (
                <tr key={product.id} className={rowClass}>
                  {/* Sticky item name */}
                  <td className={tdWrapClass + " sticky left-0 z-10 bg-inherit font-medium text-[var(--dh-wood)]"}>
                    <Link href={`/admin/items/${product.id}`} className="hover:underline">
                      {product.name}
                    </Link>
                  </td>
                  <td className={tdClass}>{product.sku ?? <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  <td className={tdClass}><LifecycleBadge lifecycle={lifecycle} /></td>
                  <td className={tdClass}>{normalizeCategory(product.category) ?? <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  <td className={tdClass}>{product.conditionNote ?? <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  <td className={tdClass}>{product.dimensions ?? <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  <td className={tdClass}>{product.measurements ?? <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  <td className={tdClass}>{product.yearOfPurchase ?? <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  <td className={tdClass}>{product.purchaseDate ?? <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  <td className={tdClass}>{product.storeSource ?? <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  {/* Money columns */}
                  <td className={tdMoneyClass}>{formatMoney(product.cogCents) ?? <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  <td className={tdMoneyClass}>{formatMoney(product.suggestedPriceLowCents) ?? <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  <td className={tdMoneyClass}>{formatMoney(product.suggestedPriceHighCents) ?? <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  <td className={tdCalcClass + " text-[rgba(110,123,85,0.6)] italic"}>
                    {midPrice !== null ? formatMoney(midPrice) : <span className="text-[rgba(110,123,85,0.4)]">—</span>}
                  </td>
                  <td className={tdMoneyClass + " font-medium"}>{formatMoney(product.finalSalesPriceCents) ?? <span className="text-[rgba(110,123,85,0.4)] font-normal">—</span>}</td>
                  <td className={tdCalcClass + " text-[rgba(110,123,85,0.6)] italic"}>{fees !== null ? formatMoney(fees) : <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  <td className={tdMoneyClass}>{formatMoney(product.shippingCents) ?? <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  <td className={tdMoneyClass}>{formatMoney(product.taxesCents) ?? <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  <td className={tdCalcClass + (netProfit !== null ? (netProfit >= 0 ? " text-[var(--dh-olive)] font-semibold" : " text-[var(--dh-terracotta)] font-semibold") : "")}>
                    {netProfit !== null ? formatMoney(netProfit) : <span className="text-[rgba(110,123,85,0.4)]">—</span>}
                  </td>
                  <td className={tdCalcClass + " text-[rgba(110,123,85,0.7)]"}>
                    {marginPct !== null ? `${marginPct.toFixed(1)}%` : <span className="text-[rgba(110,123,85,0.4)]">—</span>}
                  </td>
                  <td className={tdCalcClass + " text-[rgba(110,123,85,0.7)]"}>
                    {roiPct !== null ? `${roiPct.toFixed(1)}%` : <span className="text-[rgba(110,123,85,0.4)]">—</span>}
                  </td>
                  {/* Text / link columns */}
                  <td className={tdWrapClass}>{product.itemDescription ?? <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  <td className={tdClass}>{product.sellSiteLocation ?? <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  <td className={tdClass}>
                    {product.imageLink
                      ? <a href={product.imageLink} target="_blank" rel="noopener noreferrer" className="text-[var(--dh-olive)] underline underline-offset-2">link</a>
                      : <span className="text-[rgba(110,123,85,0.4)]">—</span>}
                  </td>
                  <td className={tdClass}>
                    {product.receiptPhotoLink
                      ? <a href={product.receiptPhotoLink} target="_blank" rel="noopener noreferrer" className="text-[var(--dh-olive)] underline underline-offset-2">link</a>
                      : <span className="text-[rgba(110,123,85,0.4)]">—</span>}
                  </td>
                  <td className={tdWrapClass}>{product.receiptDocumentation ?? <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  {/* Inventory */}
                  <td className={tdMoneyClass}>{product.inventoryQuantity}</td>
                  <td className={tdMoneyClass}>{days}</td>
                  <td className={tdClass}>
                    {product.soldAt
                      ? <span className="text-[var(--dh-terracotta)]">{new Date(product.soldAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      : <span className="text-[rgba(110,123,85,0.4)]">—</span>}
                  </td>
                  <td className={tdClass}>{product.shipDate ? formatShipDate(product.shipDate) : <span className="text-[rgba(110,123,85,0.4)]">—</span>}</td>
                  {/* Actions */}
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/admin/items/${product.id}`}
                        className="rounded-full border border-[rgba(176,141,87,0.35)] bg-transparent px-2.5 py-0.5 text-[11px] font-medium text-[var(--dh-wood)] transition hover:border-[var(--dh-brass)] hover:text-[var(--dh-brass)]"
                      >
                        Edit
                      </Link>
                      {product.status !== "SOLD" && (
                        <>
                          {(product.status === "DRAFT" || product.status === "READY") && (
                            <button
                              type="button"
                              onClick={() => handleAction(() => publishProductAction(product.id))}
                              disabled={isMutating}
                              className="rounded-full bg-[var(--dh-walnut)] px-2.5 py-0.5 text-[11px] font-medium text-white disabled:opacity-60"
                            >
                              List
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Mark "${product.name}" as sold?`)) {
                                handleAction(() => markProductSoldAction(product.id));
                              }
                            }}
                            disabled={isMutating}
                            className="rounded-full border border-[rgba(195,107,78,0.35)] bg-transparent px-2.5 py-0.5 text-[11px] font-medium text-[var(--dh-terracotta)] disabled:opacity-60"
                          >
                            Sold
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {products.length === 0 && (
          <p className="py-8 text-center text-sm text-[rgba(110,123,85,0.7)]">No items.</p>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminClient({
  initialProducts,
  initialError,
}: {
  initialProducts: AdminProduct[];
  initialError: string | null;
}) {
  const [allProducts, setAllProducts] = useState<AdminProduct[]>(initialProducts);
  const [listError, setListError] = useState<string | null>(initialError);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [isMutating, startTransition] = useTransition();

  const filteredProducts =
    statusFilter === "ALL" ? allProducts : allProducts.filter((p) => p.status === statusFilter);
  const visibleProducts = filteredProducts.slice(0, page * PAGE_SIZE);
  const hasMore = filteredProducts.length > page * PAGE_SIZE;

  async function refreshProducts() {
    const result = await listAllAdminProductsAction();
    setAllProducts(result.products);
    setListError(result.error);
  }

  function handleFilterChange(filter: StatusFilter) {
    setStatusFilter(filter);
    setPage(1);
  }

  function countByStatus(status: StatusFilter): number {
    if (status === "ALL") return allProducts.length;
    return allProducts.filter((p) => p.status === status).length;
  }

  function handleAction(action: () => Promise<{ error: string | null }>) {
    startTransition(async () => {
      setActionError(null);
      const result = await action();
      if (result.error) {
        setActionError(result.error);
        return;
      }
      await refreshProducts();
    });
  }

  return (
    <main className={`mx-auto space-y-5 px-4 py-5 ${viewMode === "detailed" ? "max-w-[98vw]" : "max-w-xl"}`}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="dh-serif text-3xl tracking-tight text-[var(--dh-wood)]">Inventory</h2>
          <p className="text-sm text-[rgba(110,123,85,0.9)]">
            {allProducts.length} item{allProducts.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          {/* View mode toggle */}
          <div className="flex overflow-hidden rounded-full border border-[rgba(176,141,87,0.3)]">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`px-3 py-1 text-xs font-medium transition ${viewMode === "cards" ? "bg-[var(--dh-walnut)] text-white" : "bg-transparent text-[var(--dh-wood)] hover:bg-[rgba(176,141,87,0.15)]"}`}
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode("detailed")}
              className={`px-3 py-1 text-xs font-medium transition ${viewMode === "detailed" ? "bg-[var(--dh-walnut)] text-white" : "bg-transparent text-[var(--dh-wood)] hover:bg-[rgba(176,141,87,0.15)]"}`}
            >
              Detailed List
            </button>
          </div>
          <button
            type="button"
            onClick={() => startTransition(async () => { await refreshProducts(); })}
            className="shrink-0 text-sm text-[var(--dh-olive)] underline underline-offset-4 hover:text-[var(--dh-walnut)] disabled:opacity-50"
            disabled={isMutating}
          >
            Refresh
          </button>
        </div>
      </header>

      {/* ── Status filter pills ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {(["ALL", "DRAFT", "READY", "ACTIVE", "SOLD"] as StatusFilter[]).map((filter) => {
          const count = countByStatus(filter);
          const isActive = statusFilter === filter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => handleFilterChange(filter)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "bg-[var(--dh-walnut)] text-white"
                  : "bg-[rgba(176,141,87,0.15)] text-[var(--dh-wood)] hover:bg-[rgba(176,141,87,0.3)]"
              }`}
            >
              {STATUS_FILTER_LABELS[filter]}
              {count > 0 && (
                <span className={`ml-1.5 text-xs ${isActive ? "opacity-80" : "text-[rgba(110,123,85,0.7)]"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {actionError && (
        <p className="rounded-2xl bg-[rgba(195,107,78,0.16)] px-4 py-3 text-base text-[var(--dh-terracotta)]">
          {actionError}
        </p>
      )}

      {listError && (
        <p className="rounded-2xl bg-[rgba(195,107,78,0.16)] px-4 py-3 text-base text-[var(--dh-terracotta)]">
          {listError}
        </p>
      )}

      {!listError && filteredProducts.length === 0 && (
        <div className="space-y-3 rounded-2xl bg-[rgba(255,255,255,0.55)] px-4 py-8 text-center">
          {statusFilter === "ALL" ? (
            <>
              <p className="text-base text-[rgba(110,123,85,0.9)]">No items yet.</p>
              <Link
                href="/admin/items/new"
                className="inline-flex rounded-full bg-[var(--dh-walnut)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--dh-wood)]"
              >
                Add your first item
              </Link>
            </>
          ) : (
            <p className="text-base text-[rgba(110,123,85,0.9)]">
              No {STATUS_FILTER_LABELS[statusFilter].toLowerCase()} items.
            </p>
          )}
        </div>
      )}

      {/* ── Detailed List view ── */}
      {viewMode === "detailed" && filteredProducts.length > 0 && (
        <DetailedList
          products={filteredProducts}
          isMutating={isMutating}
          handleAction={handleAction}
        />
      )}

      {/* ── Cards view ── */}
      {viewMode === "cards" && (
        <>
          <div className="space-y-2">
            {visibleProducts.map((product) => {
              const lifecycle = getDisplayLifecycle(product);
              const days = daysInInventory(product.createdAt);
              const { netProfit, marginPct } = calcNetProfit(product);

              return (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-2xl border border-[rgba(176,141,87,0.2)] bg-[rgba(255,255,255,0.72)] shadow-[0_2px_8px_rgba(31,27,22,0.05)] backdrop-blur-sm"
                >
                  <Link href={`/admin/items/${product.id}`} className="flex gap-3 p-3">
                    {/* Thumbnail */}
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#EDE7DB]">
                      {product.primaryImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.primaryImageUrl}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <span className="text-center text-[10px] leading-tight text-[rgba(110,123,85,0.6)]">No photo</span>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="dh-serif truncate text-base leading-snug text-[var(--dh-wood)]">
                          {product.name}
                        </h3>
                        <p className="shrink-0 text-sm font-semibold text-[var(--dh-walnut)]">
                          {formatPrice(product.priceCents)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <LifecycleBadge lifecycle={lifecycle} />
                        <span className="truncate text-xs text-[rgba(110,123,85,0.75)]">
                          {normalizeCategory(product.category) ?? "Uncategorized"}
                        </span>
                        {product.conditionNote && (
                          <span className="shrink-0 text-xs text-[rgba(110,123,85,0.6)]">
                            · {product.conditionNote}
                          </span>
                        )}
                      </div>

                      {/* Financial summary row */}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5 text-xs text-[rgba(110,123,85,0.7)]">
                        {product.cogCents !== null && (
                          <span>COG: <strong className="text-[var(--dh-wood)]">{formatMoney(product.cogCents)}</strong></span>
                        )}
                        {product.suggestedPriceLowCents !== null && product.suggestedPriceHighCents !== null && (
                          <span>
                            Range: <strong className="text-[var(--dh-wood)]">
                              {formatMoney(product.suggestedPriceLowCents)}–{formatMoney(product.suggestedPriceHighCents)}
                            </strong>
                          </span>
                        )}
                        {product.finalSalesPriceCents !== null && (
                          <span>
                            Sold for: <strong className="text-[var(--dh-wood)]">{formatMoney(product.finalSalesPriceCents)}</strong>
                          </span>
                        )}
                        {netProfit !== null && (
                          <span className={netProfit >= 0 ? "text-[var(--dh-olive)]" : "text-[var(--dh-terracotta)]"}>
                            Net: <strong>{formatMoney(netProfit)}</strong>
                            {marginPct !== null && ` (${marginPct.toFixed(0)}%)`}
                          </span>
                        )}
                      </div>

                      {/* Inventory status row */}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[rgba(110,123,85,0.7)]">
                        <span>{days}d in stock</span>
                        <span>Qty OH: <strong>{product.inventoryQuantity}</strong></span>
                        {product.storeSource && (
                          <span>from {product.storeSource}</span>
                        )}
                        {product.soldAt && (
                          <span className="text-[var(--dh-terracotta)]">
                            Sold {new Date(product.soldAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                        {product.shipDate && (
                          <span>Ships {formatShipDate(product.shipDate)}</span>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Action strip */}
                  <div className="flex items-center gap-1.5 border-t border-[rgba(176,141,87,0.1)] px-3 py-1.5">
                    {/* Status actions — hidden for sold items */}
                    {product.status !== "SOLD" && (
                      <>
                        {(product.status === "DRAFT" || product.status === "READY") && (
                          <button
                            type="button"
                            onClick={() => handleAction(() => publishProductAction(product.id))}
                            disabled={isMutating}
                            className="rounded-full bg-[var(--dh-walnut)] px-3 py-1 text-[11px] font-medium text-white transition hover:bg-[var(--dh-wood)] disabled:opacity-60"
                          >
                            Mark Listed
                          </button>
                        )}

                        {product.status === "ACTIVE" && (
                          <button
                            type="button"
                            onClick={() => handleAction(() => unpublishProductAction(product.id))}
                            disabled={isMutating}
                            className="rounded-full border border-[rgba(176,141,87,0.35)] bg-transparent px-3 py-1 text-[11px] font-medium text-[var(--dh-wood)] disabled:opacity-60"
                          >
                            Move to Draft
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Mark "${product.name}" as sold?`)) {
                              handleAction(() => markProductSoldAction(product.id));
                            }
                          }}
                          disabled={isMutating}
                          className="rounded-full border border-[rgba(195,107,78,0.35)] bg-transparent px-3 py-1 text-[11px] font-medium text-[var(--dh-terracotta)] disabled:opacity-60"
                        >
                          Mark Sold
                        </button>
                      </>
                    )}

                    {/* Edit — always visible, pushed to the right */}
                    <Link
                      href={`/admin/items/${product.id}`}
                      className="ml-auto rounded-full border border-[rgba(176,141,87,0.35)] bg-transparent px-3 py-1 text-[11px] font-medium text-[var(--dh-wood)] transition hover:border-[var(--dh-brass)] hover:text-[var(--dh-brass)]"
                    >
                      Edit
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="w-full rounded-full border border-[rgba(176,141,87,0.3)] bg-transparent px-4 py-3 text-base font-medium text-[var(--dh-wood)]"
            >
              Load more ({filteredProducts.length - page * PAGE_SIZE} remaining)
            </button>
          )}
        </>
      )}
    </main>
  );
}
