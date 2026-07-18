import Link from "next/link";
import { notFound } from "next/navigation";
import { getRegistryEntry, type SectionType } from "@fable/sections";
import { requireUser } from "@/lib/supabase/server";
import { SectionForm } from "@/components/section-form/section-form";
import { StatusBadge } from "@/components/status-badge";

export default async function SectionEditorPage({
  params,
}: {
  params: Promise<{ siteId: string; pageId: string; sectionId: string }>;
}) {
  const { siteId, pageId, sectionId } = await params;
  const { supabase } = await requireUser();

  const [{ data: page }, { data: section }] = await Promise.all([
    supabase
      .from("pages")
      .select("id, title, slug")
      .eq("id", pageId)
      .eq("site_id", siteId)
      .maybeSingle(),
    supabase
      .from("sections")
      .select("id, section_type, props, status")
      .eq("id", sectionId)
      .eq("page_id", pageId)
      .maybeSingle(),
  ]);
  if (!page || !section) notFound();

  const entry = getRegistryEntry(section.section_type);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/sites/${siteId}/pages/${pageId}`}
          className="text-sm text-muted hover:text-primary"
        >
          ← {page.title}
        </Link>
        <h2 className="text-lg font-semibold">
          {entry?.meta.label ?? section.section_type}
        </h2>
        <StatusBadge status={section.status} />
      </div>

      {entry ? (
        <SectionForm
          siteId={siteId}
          pageId={pageId}
          sectionId={sectionId}
          sectionType={section.section_type as SectionType}
          initialProps={section.props}
        />
      ) : (
        <div className="max-w-2xl rounded-card bg-surface p-6 shadow-sm ring-1 ring-black/5">
          <p className="text-sm">
            <span className="font-medium">
              “{section.section_type}” is not in the section registry
            </span>
            , so there is no form for it. It renders nothing on the live site;
            you can delete it from the page view.
          </p>
        </div>
      )}
    </div>
  );
}
