"use client";

import { useParams, useRouter } from "next/navigation";

export function SiteSwitcher({
  sites,
}: {
  sites: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const params = useParams<{ siteId?: string }>();
  if (sites.length === 0) return null;

  return (
    <select
      aria-label="Switch site"
      value={params.siteId ?? ""}
      onChange={(event) => {
        if (event.target.value) {
          router.push(`/sites/${event.target.value}/pages`);
        }
      }}
      className="rounded-btn border border-black/10 bg-surface px-2 py-1.5 text-sm"
    >
      {!params.siteId && <option value="">Select a site…</option>}
      {sites.map((site) => (
        <option key={site.id} value={site.id}>
          {site.name}
        </option>
      ))}
    </select>
  );
}
