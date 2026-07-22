import Link from "next/link";
import { notFound } from "next/navigation";
import { getRegistryEntry, type SectionType } from "@fable/sections";
import { requireUser } from "@/lib/supabase/server";
import { getSiteDelivery, sitePreviewUrl } from "@/lib/site-delivery";
import { PublishToggle } from "@/components/publish-toggle";
import { RevisionHistory } from "@/components/revision-history";
import { SectionEditor } from "@/components/section-editor";

export default async function SectionEditorPage({
  params,
}: {
  params: Promise<{ siteId: string; pageId: string; sectionId: string }>;
}) {
  const { siteId, pageId, sectionId } = await params;
  const { supabase } = await requireUser();

  const [{ data: page }, { data: section }, { data: revisions }, delivery] =
    await Promise.all([
      supabase
        .from("pages")
        .select("id, title, slug")
        .eq("id", pageId)
        .eq("site_id", siteId)
        .maybeSingle(),
      supabase
        .from("sections")
        .select("id, section_type, props, status, updated_at")
        .eq("id", sectionId)
        .eq("page_id", pageId)
        .maybeSingle(),
      supabase
        .from("section_revisions")
        .select("id, saved_by_email, created_at")
        .eq("section_id", sectionId)
        .order("id", { ascending: false }),
      getSiteDelivery(supabase, siteId),
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
        <PublishToggle
          siteId={siteId}
          pageId={pageId}
          sectionId={sectionId}
          status={section.status}
        />
      </div>

      {entry ? (
        <>
          {/* Keyed by updated_at: a restore (or concurrent edit) refreshes the
              server payload and must remount the client form, or its stale
              state would win the next save. */}
          <SectionEditor
            key={section.updated_at ?? "initial"}
            siteId={siteId}
            pageId={pageId}
            sectionId={sectionId}
            sectionType={section.section_type as SectionType}
            initialProps={section.props}
            previewSrc={sitePreviewUrl(delivery, page.slug)}
          />
          <RevisionHistory
            siteId={siteId}
            pageId={pageId}
            sectionId={sectionId}
            revisions={revisions ?? []}
          />
        </>
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
