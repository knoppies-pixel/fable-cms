import Link from "next/link";
import { notFound } from "next/navigation";
import { registry } from "@fable/sections";
import { requireUser } from "@/lib/supabase/server";
import { AddSectionDrawer, type SectionGroup } from "@/components/add-section-drawer";
import { SectionRowActions } from "@/components/section-row-actions";
import { StatusBadge } from "@/components/status-badge";

const CATEGORY_LABELS: Record<string, string> = {
  headers: "Headers",
  content: "Content",
  marketing: "Marketing",
  media: "Media",
  forms: "Forms",
};

function sectionGroups(): SectionGroup[] {
  const groups = new Map<string, SectionGroup>();
  for (const entry of Object.values(registry)) {
    const { type, label, description, category } = entry.meta;
    const group = groups.get(category) ?? {
      category: CATEGORY_LABELS[category] ?? category,
      sections: [],
    };
    group.sections.push({ type, label, description });
    groups.set(category, group);
  }
  return [...groups.values()];
}

export default async function PageDetailPage({
  params,
}: {
  params: Promise<{ siteId: string; pageId: string }>;
}) {
  const { siteId, pageId } = await params;
  const { supabase } = await requireUser();
  const { data: page, error } = await supabase
    .from("pages")
    .select(
      "id, slug, title, status, sections(id, section_type, sort_order, status, updated_at)",
    )
    .eq("id", pageId)
    .eq("site_id", siteId)
    .order("sort_order", { ascending: true, referencedTable: "sections" })
    .maybeSingle();
  if (error || !page) notFound();

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/sites/${siteId}/pages`}
          className="text-sm text-muted hover:text-primary"
        >
          ← Pages
        </Link>
        <h2 className="text-lg font-semibold">{page.title}</h2>
        <span className="font-mono text-xs text-muted">{page.slug}</span>
        <StatusBadge status={page.status} />
        <div className="ml-auto">
          <AddSectionDrawer
            siteId={siteId}
            pageId={pageId}
            groups={sectionGroups()}
          />
        </div>
      </div>

      <ul className="space-y-2">
        {page.sections.map((section) => {
          const meta =
            section.section_type in registry
              ? registry[section.section_type as keyof typeof registry].meta
              : null;
          return (
            <li
              key={section.id}
              className="flex items-center gap-3 rounded-card bg-surface px-4 py-3 shadow-sm ring-1 ring-black/5"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {meta?.label ?? `Unknown type "${section.section_type}"`}
                </p>
                <p className="truncate text-xs text-muted">
                  {meta?.description ??
                    "Not in the registry — it renders nothing in production."}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <StatusBadge status={section.status} />
                {meta && (
                  <Link
                    href={`/sites/${siteId}/pages/${pageId}/sections/${section.id}`}
                    className="rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast hover:opacity-90"
                  >
                    Edit
                  </Link>
                )}
                <SectionRowActions
                  siteId={siteId}
                  pageId={pageId}
                  sectionId={section.id}
                  label={meta?.label ?? section.section_type}
                />
              </div>
            </li>
          );
        })}
        {page.sections.length === 0 && (
          <li className="rounded-card bg-surface px-4 py-8 text-center text-sm text-muted shadow-sm ring-1 ring-black/5">
            No sections yet — add one to start building this page.
          </li>
        )}
      </ul>
    </div>
  );
}
