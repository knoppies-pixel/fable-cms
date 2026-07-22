"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@fable/db";
import { getRegistryEntry } from "@fable/sections";
import { logActivity } from "./activity";
import { revalidateSite } from "./site-delivery";
import { requireUser } from "./supabase/server";

/**
 * All page/section mutations. Every write goes through the caller's own
 * RLS-scoped client, so Postgres policies (site membership, role, column
 * guards) are the enforcement layer — these actions only add input
 * validation and friendly errors on top.
 *
 * Every successful content mutation pings the site's /api/revalidate
 * (revalidateSite) so published output updates within seconds. A failed ping
 * comes back as a non-fatal `warning` — the row is already saved.
 */

export type ActionResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const fail = (error: string): ActionResult => ({ ok: false, error });

/** Nav label of a page, for activity-log summaries. Falls back gracefully. */
async function pageTitle(
  supabase: SupabaseClient<Database>,
  pageId: string,
): Promise<string> {
  const { data } = await supabase
    .from("pages")
    .select("title")
    .eq("id", pageId)
    .maybeSingle();
  return data?.title ?? "a page";
}

const sectionLabel = (sectionType: string): string =>
  getRegistryEntry(sectionType)?.meta.label ?? sectionType;

// --- Pages -----------------------------------------------------------------

const pageSlug = z
  .string()
  .regex(
    /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/,
    "Slug must look like / or /about or /services/gutters (lowercase letters, digits, hyphens).",
  );

export async function createPage(
  siteId: string,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return fail("Page title is required.");

  const rawSlug = String(formData.get("slug") ?? "").trim();
  const normalized = rawSlug === "" ? "/" : rawSlug.startsWith("/") ? rawSlug : `/${rawSlug}`;
  const slugCheck = pageSlug.safeParse(normalized.toLowerCase());
  if (!slugCheck.success) {
    return fail(slugCheck.error.issues[0]?.message ?? "Invalid slug.");
  }
  const slug = slugCheck.data;

  const { data: siblings, error: siblingsError } = await supabase
    .from("pages")
    .select("sort_order")
    .eq("site_id", siteId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (siblingsError) return fail("Could not load existing pages.");
  const sortOrder = (siblings?.[0]?.sort_order ?? -1) + 1;

  const { data: page, error } = await supabase
    .from("pages")
    .insert({ site_id: siteId, slug, title, sort_order: sortOrder })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return fail(`A page with slug ${slug} already exists.`);
    if (error.code === "42501") return fail("You don't have permission to create pages.");
    return fail("Could not create the page.");
  }

  await logActivity(supabase, user, {
    siteId,
    action: "page.create",
    entityType: "page",
    entityId: page.id,
    summary: `Created page “${title}” (${slug})`,
  });
  revalidatePath(`/sites/${siteId}/pages`);
  redirect(`/sites/${siteId}/pages/${page.id}`);
}

/**
 * Page SEO (the `pages.seo` jsonb — the one page column client editors may
 * write). `seo.title` overrides the site's derived `<title>`; the page's
 * `title` column stays the short nav label. Empty fields are removed from the
 * jsonb (so the site falls back to its defaults); unknown keys are preserved.
 */
const seoInput = z.object({
  title: z.string().trim().max(150),
  description: z.string().trim().max(300),
  noindex: z.boolean(),
});

export async function savePageSeo(
  siteId: string,
  pageId: string,
  input: { title: string; description: string; noindex: boolean },
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const parsed = seoInput.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid SEO fields.");
  }

  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select("title, seo")
    .eq("id", pageId)
    .eq("site_id", siteId)
    .maybeSingle();
  if (pageError || !page) return fail("Page not found.");

  const seo: Record<string, unknown> = {
    ...(typeof page.seo === "object" && page.seo !== null ? page.seo : {}),
  };
  for (const [key, value] of Object.entries({
    title: parsed.data.title || undefined,
    description: parsed.data.description || undefined,
    noindex: parsed.data.noindex || undefined,
  })) {
    if (value === undefined) delete seo[key];
    else seo[key] = value;
  }

  const { error } = await supabase
    .from("pages")
    .update({ seo: seo as never })
    .eq("id", pageId)
    .eq("site_id", siteId);
  if (error) {
    if (error.code === "42501") return fail("You don't have permission to edit this page's SEO.");
    return fail("Could not save the SEO settings.");
  }

  await logActivity(supabase, user, {
    siteId,
    action: "page.seo",
    entityType: "page",
    entityId: pageId,
    summary: `Updated SEO for “${page.title}”`,
    detail: { seo: seo as Json },
  });
  revalidatePath(`/sites/${siteId}/pages/${pageId}`);
  return { ok: true, warning: await revalidateSite(supabase, siteId) };
}

// --- Sections --------------------------------------------------------------

export async function addSection(
  siteId: string,
  pageId: string,
  sectionType: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const entry = getRegistryEntry(sectionType);
  if (!entry) return fail(`Unknown section type: ${sectionType}`);

  const { data: siblings, error: siblingsError } = await supabase
    .from("sections")
    .select("sort_order")
    .eq("page_id", pageId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (siblingsError) return fail("Could not load the page's sections.");
  const sortOrder = (siblings?.[0]?.sort_order ?? -1) + 1;

  const { data: created, error } = await supabase
    .from("sections")
    .insert({
      page_id: pageId,
      section_type: sectionType,
      props: entry.meta.defaults as never,
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "42501") return fail("You don't have permission to add sections.");
    return fail("Could not add the section.");
  }

  await logActivity(supabase, user, {
    siteId,
    action: "section.add",
    entityType: "section",
    entityId: created.id,
    summary: `Added a ${entry.meta.label} section to “${await pageTitle(supabase, pageId)}”`,
  });
  revalidatePath(`/sites/${siteId}/pages/${pageId}`);
  return { ok: true, warning: await revalidateSite(supabase, siteId) };
}

export async function duplicateSection(
  siteId: string,
  pageId: string,
  sectionId: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const { data: source, error: sourceError } = await supabase
    .from("sections")
    .select("page_id, section_type, props, status")
    .eq("id", sectionId)
    .maybeSingle();
  if (sourceError || !source) return fail("Section not found.");

  const { data: siblings } = await supabase
    .from("sections")
    .select("sort_order")
    .eq("page_id", source.page_id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const sortOrder = (siblings?.[0]?.sort_order ?? -1) + 1;

  const { data: created, error } = await supabase
    .from("sections")
    .insert({
      page_id: source.page_id,
      section_type: source.section_type,
      props: source.props as never,
      status: source.status,
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "42501") return fail("You don't have permission to duplicate sections.");
    return fail("Could not duplicate the section.");
  }

  await logActivity(supabase, user, {
    siteId,
    action: "section.duplicate",
    entityType: "section",
    entityId: created.id,
    summary: `Duplicated a ${sectionLabel(source.section_type)} section on “${await pageTitle(supabase, pageId)}”`,
    detail: { sourceSectionId: sectionId },
  });
  revalidatePath(`/sites/${siteId}/pages/${pageId}`);
  return { ok: true, warning: await revalidateSite(supabase, siteId) };
}

export async function deleteSection(
  siteId: string,
  pageId: string,
  sectionId: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  // Deleting a section cascades its revision history away, so the activity
  // log keeps a full rescue copy of what was deleted.
  const { data: doomed } = await supabase
    .from("sections")
    .select("section_type, props, sort_order, status")
    .eq("id", sectionId)
    .maybeSingle();

  const { error, count } = await supabase
    .from("sections")
    .delete({ count: "exact" })
    .eq("id", sectionId);
  if (error) {
    if (error.code === "42501") return fail("You don't have permission to delete sections.");
    return fail("Could not delete the section.");
  }
  if (count === 0) return fail("Section not found (or no permission to delete it).");

  await logActivity(supabase, user, {
    siteId,
    action: "section.delete",
    entityType: "section",
    entityId: sectionId,
    summary: `Deleted a ${sectionLabel(doomed?.section_type ?? "section")} section from “${await pageTitle(supabase, pageId)}”`,
    detail: { deleted: (doomed ?? null) as Json },
  });
  revalidatePath(`/sites/${siteId}/pages/${pageId}`);
  return { ok: true, warning: await revalidateSite(supabase, siteId) };
}

export async function saveSectionProps(
  siteId: string,
  pageId: string,
  sectionId: string,
  props: unknown,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const { data: section, error: sectionError } = await supabase
    .from("sections")
    .select("id, section_type, props")
    .eq("id", sectionId)
    .maybeSingle();
  if (sectionError || !section) return fail("Section not found.");

  const entry = getRegistryEntry(section.section_type);
  if (!entry) {
    return fail(
      `"${section.section_type}" is not in the registry, so it has no editable form.`,
    );
  }

  const parsed = entry.schema.safeParse(props);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "_root";
      (fieldErrors[path] ??= []).push(issue.message);
    }
    return { ok: false, error: "Some fields are invalid.", fieldErrors };
  }

  // A save that changes nothing writes nothing: no phantom revision, no
  // activity noise, no pointless site revalidation.
  if (JSON.stringify(parsed.data) === JSON.stringify(section.props)) {
    return { ok: true };
  }

  const { error } = await supabase
    .from("sections")
    .update({ props: parsed.data as never })
    .eq("id", sectionId);
  if (error) {
    if (error.code === "42501") return fail("You don't have permission to edit this section.");
    return fail("Could not save the section.");
  }

  await logActivity(supabase, user, {
    siteId,
    action: "section.save",
    entityType: "section",
    entityId: sectionId,
    summary: `Edited the ${sectionLabel(section.section_type)} section on “${await pageTitle(supabase, pageId)}”`,
  });
  revalidatePath(`/sites/${siteId}/pages/${pageId}`);
  revalidatePath(`/sites/${siteId}/pages/${pageId}/sections/${sectionId}`);
  return { ok: true, warning: await revalidateSite(supabase, siteId) };
}

// --- Ordering & publishing (Phase 4) ---------------------------------------

export async function reorderSections(
  siteId: string,
  pageId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const idsCheck = z.array(z.uuid()).min(1).safeParse(orderedIds);
  if (!idsCheck.success) return fail("Invalid section order.");

  // The new order must be a permutation of the page's current sections —
  // otherwise the caller's list is stale (concurrent add/delete).
  const { data: rows, error: rowsError } = await supabase
    .from("sections")
    .select("id")
    .eq("page_id", pageId);
  if (rowsError || !rows) return fail("Could not load the page's sections.");
  const current = new Set(rows.map((row) => row.id));
  if (
    idsCheck.data.length !== current.size ||
    idsCheck.data.some((id) => !current.has(id))
  ) {
    return fail("The section list changed underneath you — reload and try again.");
  }

  const results = await Promise.all(
    idsCheck.data.map((id, index) =>
      supabase
        .from("sections")
        .update({ sort_order: index })
        .eq("id", id)
        .eq("page_id", pageId),
    ),
  );
  const failure = results.find((result) => result.error)?.error;
  revalidatePath(`/sites/${siteId}/pages/${pageId}`);
  if (failure) {
    if (failure.code === "42501") {
      return fail("Only studio admins can reorder sections.");
    }
    return fail("Could not save the new order.");
  }

  await logActivity(supabase, user, {
    siteId,
    action: "section.reorder",
    entityType: "page",
    entityId: pageId,
    summary: `Reordered ${idsCheck.data.length} sections on “${await pageTitle(supabase, pageId)}”`,
    detail: { order: idsCheck.data },
  });
  return { ok: true, warning: await revalidateSite(supabase, siteId) };
}

const publishStatus = z.enum(["draft", "published"]);

export async function setPageStatus(
  siteId: string,
  pageId: string,
  status: "draft" | "published",
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const statusCheck = publishStatus.safeParse(status);
  if (!statusCheck.success) return fail("Invalid status.");

  const patch =
    statusCheck.data === "published"
      ? { status: statusCheck.data, published_at: new Date().toISOString() }
      : { status: statusCheck.data, published_at: null };
  const { error, count } = await supabase
    .from("pages")
    .update(patch, { count: "exact" })
    .eq("id", pageId)
    .eq("site_id", siteId);
  if (error) {
    if (error.code === "42501") return fail("Only studio admins can publish pages.");
    return fail("Could not update the page status.");
  }
  if (count === 0) return fail("Page not found.");

  await logActivity(supabase, user, {
    siteId,
    action: statusCheck.data === "published" ? "page.publish" : "page.unpublish",
    entityType: "page",
    entityId: pageId,
    summary: `${statusCheck.data === "published" ? "Published" : "Unpublished"} page “${await pageTitle(supabase, pageId)}”`,
  });
  revalidatePath(`/sites/${siteId}/pages`);
  revalidatePath(`/sites/${siteId}/pages/${pageId}`);
  return { ok: true, warning: await revalidateSite(supabase, siteId) };
}

export async function setSectionStatus(
  siteId: string,
  pageId: string,
  sectionId: string,
  status: "draft" | "published",
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const statusCheck = publishStatus.safeParse(status);
  if (!statusCheck.success) return fail("Invalid status.");

  const { error, count } = await supabase
    .from("sections")
    .update({ status: statusCheck.data }, { count: "exact" })
    .eq("id", sectionId)
    .eq("page_id", pageId);
  if (error) {
    if (error.code === "42501") return fail("Only studio admins can publish sections.");
    return fail("Could not update the section status.");
  }
  if (count === 0) return fail("Section not found.");

  await logActivity(supabase, user, {
    siteId,
    action: statusCheck.data === "published" ? "section.publish" : "section.unpublish",
    entityType: "section",
    entityId: sectionId,
    summary: `${statusCheck.data === "published" ? "Published" : "Unpublished"} a section on “${await pageTitle(supabase, pageId)}”`,
  });
  revalidatePath(`/sites/${siteId}/pages/${pageId}`);
  revalidatePath(`/sites/${siteId}/pages/${pageId}/sections/${sectionId}`);
  return { ok: true, warning: await revalidateSite(supabase, siteId) };
}

// --- Revisions & submissions (Phase 7) --------------------------------------

/**
 * Restore a section's props to an earlier revision. The write goes through
 * the normal RLS-guarded update, so the snapshot trigger records the state
 * being replaced — restoring is itself undoable.
 */
export async function restoreSectionRevision(
  siteId: string,
  pageId: string,
  sectionId: string,
  revisionId: number,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const [{ data: section, error: sectionError }, { data: revision, error: revisionError }] =
    await Promise.all([
      supabase
        .from("sections")
        .select("id, section_type, props")
        .eq("id", sectionId)
        .maybeSingle(),
      supabase
        .from("section_revisions")
        .select("id, section_type, props, created_at")
        .eq("id", revisionId)
        .eq("section_id", sectionId)
        .maybeSingle(),
    ]);
  if (sectionError || !section) return fail("Section not found.");
  if (revisionError || !revision) return fail("Revision not found.");
  if (revision.section_type !== section.section_type) {
    return fail("This revision belongs to a different section type and can't be restored.");
  }

  const entry = getRegistryEntry(section.section_type);
  if (!entry) return fail(`"${section.section_type}" is not in the registry.`);

  // Parse through the current schema: newer fields pick up their defaults; a
  // revision the schema can no longer accept is refused instead of half-applied.
  const parsed = entry.schema.safeParse(revision.props);
  if (!parsed.success) {
    return fail("This revision no longer matches the section's schema and can't be restored.");
  }

  if (JSON.stringify(parsed.data) === JSON.stringify(section.props)) {
    return { ok: true }; // already identical — nothing to restore
  }

  const { error } = await supabase
    .from("sections")
    .update({ props: parsed.data as never })
    .eq("id", sectionId);
  if (error) {
    if (error.code === "42501") return fail("You don't have permission to edit this section.");
    return fail("Could not restore the revision.");
  }

  const savedAt = revision.created_at
    ? new Date(revision.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
    : "an earlier version";
  await logActivity(supabase, user, {
    siteId,
    action: "section.restore",
    entityType: "section",
    entityId: sectionId,
    summary: `Restored the ${sectionLabel(section.section_type)} section on “${await pageTitle(supabase, pageId)}” to the version saved ${savedAt}`,
    detail: { revisionId },
  });
  revalidatePath(`/sites/${siteId}/pages/${pageId}`);
  revalidatePath(`/sites/${siteId}/pages/${pageId}/sections/${sectionId}`);
  return { ok: true, warning: await revalidateSite(supabase, siteId) };
}

export async function deleteSubmission(
  siteId: string,
  submissionId: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireUser();

  const { data: doomed } = await supabase
    .from("form_submissions")
    .select("name, email, created_at")
    .eq("id", submissionId)
    .eq("site_id", siteId)
    .maybeSingle();

  const { error, count } = await supabase
    .from("form_submissions")
    .delete({ count: "exact" })
    .eq("id", submissionId)
    .eq("site_id", siteId);
  if (error) return fail("Could not delete the submission.");
  if (count === 0) return fail("Submission not found.");

  await logActivity(supabase, user, {
    siteId,
    action: "submission.delete",
    entityType: "submission",
    entityId: submissionId,
    summary: `Deleted a form submission from ${doomed?.name ?? "unknown"} (${doomed?.email ?? "no email"})`,
    detail: { receivedAt: doomed?.created_at ?? null },
  });
  revalidatePath(`/sites/${siteId}/submissions`);
  return { ok: true };
}
