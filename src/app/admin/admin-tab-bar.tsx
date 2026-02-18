"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Tab = {
  href: string;
  label: string;
  icon: ReactNode;
  isActive: (pathname: string) => boolean;
};

function IconInventory() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zm2 0v4h12v-4a.5.5 0 0 0-.5-.5h-11a.5.5 0 0 0-.5.5m0 6v5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-5z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconAdd() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M12 4a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5a1 1 0 0 1 1-1"
        fill="currentColor"
      />
    </svg>
  );
}

function IconImport() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 3.99a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.41L11 12.59V4a1 1 0 0 1 1-1m-6 14a1 1 0 0 1 1 1v1h10v-1a1 1 0 1 1 2 0v1a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-1a1 1 0 0 1 1-1"
        fill="currentColor"
      />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M10.22 2.86a2 2 0 0 1 3.56 0l.6 1.2a1 1 0 0 0 .9.55h1.34a2 2 0 0 1 1.78 2.91l-.58 1.16a1 1 0 0 0 .06.98l.78 1.1a2 2 0 0 1-.27 2.62l-.96.96a2 2 0 0 1-2.62.27l-1.1-.78a1 1 0 0 0-.98-.06l-1.16.58a2 2 0 0 1-2.91-1.78v-1.34a1 1 0 0 0-.55-.9l-1.2-.6a2 2 0 0 1 0-3.56l1.2-.6a1 1 0 0 0 .55-.9V4.98a2 2 0 0 1 2.91-1.78l1.16.58a1 1 0 0 0 .98-.06zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6"
        fill="currentColor"
      />
    </svg>
  );
}

const TABS: Tab[] = [
  {
    href: "/admin",
    label: "Feed",
    icon: <IconInventory />,
    isActive: (pathname) =>
      pathname === "/admin" || (pathname.startsWith("/admin/items/") && pathname !== "/admin/items/new"),
  },
  {
    href: "/admin/items/new",
    label: "Add",
    icon: <IconAdd />,
    isActive: (pathname) => pathname === "/admin/items/new",
  },
  {
    href: "/admin/import",
    label: "Import",
    icon: <IconImport />,
    isActive: (pathname) => pathname.startsWith("/admin/import"),
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: <IconSettings />,
    isActive: (pathname) => pathname.startsWith("/admin/settings"),
  },
];

export default function AdminTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[rgba(176,141,87,0.2)] bg-[rgba(245,241,232,0.8)] pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur-md">
      <div className="mx-auto grid max-w-xl grid-cols-4 gap-1 px-3">
        {TABS.map((tab) => {
          const active = tab.isActive(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-2 text-[11px] font-medium transition ${
                active ? "text-[var(--dh-walnut)]" : "text-[rgba(110,123,85,0.6)]"
              }`}
            >
              {tab.icon}
              <span className="mt-1">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
