"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { createInventoryItemAction, type CreateInventoryItemState } from "@/app/admin/actions";

const INITIAL_STATE: CreateInventoryItemState = {
  error: null,
  warning: null,
  createdProduct: null,
};

type LocalPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

function buildPhotoId(file: File): string {
  return `${file.name}-${file.lastModified}-${file.size}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function NewItemClient() {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [state, formAction, isPending] = useActionState(createInventoryItemAction, INITIAL_STATE);

  useEffect(() => {
    return () => {
      for (const photo of photos) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
  }, [photos]);

  const createdId = useMemo(() => {
    return state.createdProduct?.id ?? null;
  }, [state.createdProduct]);

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const nextPhotos: LocalPhoto[] = [];

    for (const file of Array.from(fileList)) {
      if (file.size <= 0) {
        continue;
      }

      const previewUrl = URL.createObjectURL(file);
      nextPhotos.push({
        id: buildPhotoId(file),
        file,
        previewUrl,
      });
    }

    if (nextPhotos.length > 0) {
      setPhotos((prev) => [...prev, ...nextPhotos]);
    }
  }

  function removePhoto(photoId: string) {
    setPhotos((prev) => {
      const target = prev.find((photo) => photo.id === photoId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((photo) => photo.id !== photoId);
    });
  }

  return (
    <section className="space-y-6 pb-24">
      <header className="space-y-2">
        <h2 className="dh-serif text-4xl tracking-tight text-[var(--dh-wood)]">Add Item</h2>
        <p className="text-base text-[rgba(110,123,85,0.9)]">Take photos first, fill the basics, then save as Draft or Ready.</p>
      </header>

      <form
        action={async (formData) => {
          for (const photo of photos) {
            formData.append("photos", photo.file, photo.file.name);
          }

          await formAction(formData);
        }}
        className="space-y-6"
      >
        <section className="space-y-3 rounded-2xl bg-[rgba(255,255,255,0.55)] p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--dh-olive)]">Photos</h3>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="rounded-full bg-[var(--dh-walnut)] px-3 py-4 text-base font-medium text-white transition hover:bg-[var(--dh-wood)]"
            >
              Take Photo
            </button>
            <button
              type="button"
              onClick={() => libraryInputRef.current?.click()}
              className="rounded-full bg-[rgba(176,141,87,0.2)] px-3 py-4 text-base font-medium text-[var(--dh-wood)]"
            >
              Upload from Library
            </button>
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(event) => {
              addFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />

          <input
            ref={libraryInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              addFiles(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />

          {photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((photo) => (
                <div key={photo.id} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#EDE7DB]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.previewUrl} alt={photo.file.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--dh-olive)]">Required</h3>

          <label className="block text-sm font-medium text-[var(--dh-wood)]">
            Title
            <input
              name="name"
              type="text"
              required
              className="mt-1 w-full rounded-xl border border-[rgba(176,141,87,0.3)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-base text-[var(--dh-wood)] outline-none focus:ring-2 focus:ring-[var(--dh-walnut)]"
            />
          </label>

          <label className="block text-sm font-medium text-[var(--dh-wood)]">
            Price (USD)
            <input
              name="price"
              type="text"
              inputMode="decimal"
              required
              placeholder="125.00"
              className="mt-1 w-full rounded-xl border border-[rgba(176,141,87,0.3)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-base text-[var(--dh-wood)] outline-none focus:ring-2 focus:ring-[var(--dh-walnut)]"
            />
          </label>

          <label className="block text-sm font-medium text-[var(--dh-wood)]">
            Category
            <input
              name="category"
              type="text"
              required
              className="mt-1 w-full rounded-xl border border-[rgba(176,141,87,0.3)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-base text-[var(--dh-wood)] outline-none focus:ring-2 focus:ring-[var(--dh-walnut)]"
            />
          </label>

          <label className="block text-sm font-medium text-[var(--dh-wood)]">
            Condition
            <input
              name="conditionNote"
              type="text"
              required
              className="mt-1 w-full rounded-xl border border-[rgba(176,141,87,0.3)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-base text-[var(--dh-wood)] outline-none focus:ring-2 focus:ring-[var(--dh-walnut)]"
            />
          </label>

          <label className="block text-sm font-medium text-[var(--dh-wood)]">
            Dimensions (L x W x H)
            <input
              name="dimensions"
              type="text"
              required
              placeholder='e.g. 32" x 20" x 18"'
              className="mt-1 w-full rounded-xl border border-[rgba(176,141,87,0.3)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-base text-[var(--dh-wood)] outline-none focus:ring-2 focus:ring-[var(--dh-walnut)]"
            />
          </label>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--dh-olive)]">Optional</h3>

          <label className="block text-sm font-medium text-[var(--dh-wood)]">
            SKU
            <input
              name="sku"
              type="text"
              className="mt-1 w-full rounded-xl border border-[rgba(176,141,87,0.3)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-base text-[var(--dh-wood)] outline-none focus:ring-2 focus:ring-[var(--dh-walnut)]"
            />
          </label>

          <label className="block text-sm font-medium text-[var(--dh-wood)]">
            Weight (lbs)
            <input
              name="weightLbs"
              type="text"
              className="mt-1 w-full rounded-xl border border-[rgba(176,141,87,0.3)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-base text-[var(--dh-wood)] outline-none focus:ring-2 focus:ring-[var(--dh-walnut)]"
            />
          </label>

          <label className="block text-sm font-medium text-[var(--dh-wood)]">
            Suggested Price Low (USD)
            <input
              name="suggestedPriceLow"
              type="text"
              className="mt-1 w-full rounded-xl border border-[rgba(176,141,87,0.3)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-base text-[var(--dh-wood)] outline-none focus:ring-2 focus:ring-[var(--dh-walnut)]"
            />
          </label>

          <label className="block text-sm font-medium text-[var(--dh-wood)]">
            Suggested Price High (USD)
            <input
              name="suggestedPriceHigh"
              type="text"
              className="mt-1 w-full rounded-xl border border-[rgba(176,141,87,0.3)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-base text-[var(--dh-wood)] outline-none focus:ring-2 focus:ring-[var(--dh-walnut)]"
            />
          </label>

          <label className="block text-sm font-medium text-[var(--dh-wood)]">
            Notes
            <textarea
              name="description"
              rows={4}
              className="mt-1 w-full rounded-xl border border-[rgba(176,141,87,0.3)] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-base text-[var(--dh-wood)] outline-none focus:ring-2 focus:ring-[var(--dh-walnut)]"
            />
          </label>
        </section>

        <div className="sticky bottom-20 z-10 grid grid-cols-2 gap-2 bg-[rgba(245,241,232,0.95)] pt-2 backdrop-blur">
          <button
            type="submit"
            name="intent"
            value="draft"
            disabled={isPending}
            className="rounded-full bg-[rgba(176,141,87,0.2)] px-3 py-4 text-base font-semibold text-[var(--dh-wood)] disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Save Draft"}
          </button>

          <button
            type="submit"
            name="intent"
            value="ready"
            disabled={isPending}
            className="rounded-full bg-[var(--dh-walnut)] px-3 py-4 text-base font-semibold text-white transition hover:bg-[var(--dh-wood)] disabled:opacity-60"
          >
            {isPending ? "Saving..." : "Save Ready"}
          </button>
        </div>
      </form>

      {state.error && (
        <p className="rounded-2xl bg-[rgba(195,107,78,0.16)] px-4 py-3 text-base text-[var(--dh-terracotta)]">{state.error}</p>
      )}

      {state.warning && (
        <p className="rounded-2xl bg-[rgba(176,141,87,0.2)] px-4 py-3 text-base text-[var(--dh-walnut)]">{state.warning}</p>
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
