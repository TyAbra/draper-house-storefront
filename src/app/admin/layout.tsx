import Link from "next/link";

import AdminTabBar from "@/app/admin/admin-tab-bar";
import { requireAppAuthenticated } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAppAuthenticated();

  return (
    <div className="min-h-screen bg-[var(--dh-cream)] pb-28">
      <header className="sticky top-0 z-20 border-b border-[rgba(176,141,87,0.2)] bg-[rgba(245,241,232,0.95)] backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-4">
          <h1 className="dh-serif text-3xl font-normal tracking-wide text-[var(--dh-wood)]">Draper House</h1>
          <Link
            href="/admin/items/new"
            className="rounded-full bg-[var(--dh-walnut)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--dh-wood)]"
          >
            Add Item
          </Link>
        </div>
      </header>

      {children}

      <AdminTabBar />
    </div>
  );
}
