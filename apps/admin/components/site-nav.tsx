"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteNav({ siteId }: { siteId: string }) {
  const pathname = usePathname();
  const tabs = [
    { label: "Pages", href: `/sites/${siteId}/pages` },
    { label: "Media", href: `/sites/${siteId}/media` },
  ];

  return (
    <nav className="flex gap-1 rounded-btn bg-surface p-1 ring-1 ring-black/5">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? "rounded-btn bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast"
                : "rounded-btn px-3 py-1.5 text-sm text-muted hover:text-primary"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
