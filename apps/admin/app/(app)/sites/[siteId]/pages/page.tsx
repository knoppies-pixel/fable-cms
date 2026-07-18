import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { NewPageForm } from "@/components/new-page-form";
import { StatusBadge } from "@/components/status-badge";

export default async function PageListPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { supabase } = await requireUser();
  const { data: pages } = await supabase
    .from("pages")
    .select("id, slug, title, status, sort_order, updated_at, sections(count)")
    .eq("site_id", siteId)
    .order("sort_order");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Pages
        </h2>
        <ul className="overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-black/5">
          {(pages ?? []).map((page) => (
            <li key={page.id} className="border-b border-black/5 last:border-b-0">
              <Link
                href={`/sites/${siteId}/pages/${page.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-alt"
              >
                <span className="font-medium">{page.title}</span>
                <span className="font-mono text-xs text-muted">{page.slug}</span>
                <span className="ml-auto text-xs text-muted">
                  {page.sections[0]?.count ?? 0} sections
                </span>
                <StatusBadge status={page.status} />
              </Link>
            </li>
          ))}
          {(pages ?? []).length === 0 && (
            <li className="px-4 py-6 text-sm text-muted">No pages yet.</li>
          )}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          New page
        </h2>
        <NewPageForm siteId={siteId} />
      </section>
    </div>
  );
}
