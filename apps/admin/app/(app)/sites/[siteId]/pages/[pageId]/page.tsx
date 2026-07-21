import Link from "next/link";
import { notFound } from "next/navigation";
import { registry } from "@fable/sections";
import { requireUser } from "@/lib/supabase/server";
import { getSiteDelivery, sitePreviewUrl } from "@/lib/site-delivery";
import { AddSectionDrawer, type SectionGroup } from "@/components/add-section-drawer";
import { PageSeoForm, type PageSeo } from "@/components/page-seo-form";
import { PublishToggle } from "@/components/publish-toggle";
import { SectionList, type SectionListItem } from "@/components/section-list";

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
  const [{ data: page, error }, delivery] = await Promise.all([
    supabase
      .from("pages")
      .select(
        "id, slug, title, seo, status, sections(id, section_type, sort_order, status, updated_at)",
      )
      .eq("id", pageId)
      .eq("site_id", siteId)
      .order("sort_order", { ascending: true, referencedTable: "sections" })
      .maybeSingle(),
    getSiteDelivery(supabase, siteId),
  ]);
  if (error || !page) notFound();

  const previewUrl = sitePreviewUrl(delivery, page.slug);
  const sections: SectionListItem[] = page.sections.map((section) => {
    const meta =
      section.section_type in registry
        ? registry[section.section_type as keyof typeof registry].meta
        : null;
    return {
      id: section.id,
      label: meta?.label ?? `Unknown type "${section.section_type}"`,
      description:
        meta?.description ??
        "Not in the registry — it renders nothing in production.",
      status: section.status,
      editable: meta !== null,
    };
  });

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
        <PublishToggle siteId={siteId} pageId={pageId} status={page.status} />
        <div className="ml-auto flex items-center gap-2">
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-btn px-3 py-1.5 text-sm text-muted hover:bg-surface-alt hover:text-primary"
            >
              Preview ↗
            </a>
          )}
          <AddSectionDrawer
            siteId={siteId}
            pageId={pageId}
            groups={sectionGroups()}
          />
        </div>
      </div>

      <PageSeoForm
        siteId={siteId}
        pageId={pageId}
        navTitle={page.title}
        seo={(page.seo ?? {}) as PageSeo}
      />

      <SectionList siteId={siteId} pageId={pageId} sections={sections} />
    </div>
  );
}
