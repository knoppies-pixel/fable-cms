"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getRegistryEntry } from "@fable/sections";
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
  const { supabase } = await requireUser();

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

  revalidatePath(`/sites/${siteId}/pages`);
  redirect(`/sites/${siteId}/pages/${page.id}`);
}

// --- Sections --------------------------------------------------------------

export async function addSection(
  siteId: string,
  pageId: string,
  sectionType: string,
): Promise<ActionResult> {
  const { supabase } = await requireUser();

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

  const { error } = await supabase.from("sections").insert({
    page_id: pageId,
    section_type: sectionType,
    props: entry.meta.defaults as never,
    sort_order: sortOrder,
  });
  if (error) {
    if (error.code === "42501") return fail("You don't have permission to add sections.");
    return fail("Could not add the section.");
  }

  revalidatePath(`/sites/${siteId}/pages/${pageId}`);
  return { ok: true, warning: await revalidateSite(supabase, siteId) };
}

export async function duplicateSection(
  siteId: string,
  pageId: string,
  sectionId: string,
): Promise<ActionResult> {
  const { supabase } = await requireUser();

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

  const { error } = await supabase.from("sections").insert({
    page_id: source.page_id,
    section_type: source.section_type,
    props: source.props as never,
    status: source.status,
    sort_order: sortOrder,
  });
  if (error) {
    if (error.code === "42501") return fail("You don't have permission to duplicate sections.");
    return fail("Could not duplicate the section.");
  }

  revalidatePath(`/sites/${siteId}/pages/${pageId}`);
  return { ok: true, warning: await revalidateSite(supabase, siteId) };
}

export async function deleteSection(
  siteId: string,
  pageId: string,
  sectionId: string,
): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const { error, count } = await supabase
    .from("sections")
    .delete({ count: "exact" })
    .eq("id", sectionId);
  if (error) {
    if (error.code === "42501") return fail("You don't have permission to delete sections.");
    return fail("Could not delete the section.");
  }
  if (count === 0) return fail("Section not found (or no permission to delete it).");

  revalidatePath(`/sites/${siteId}/pages/${pageId}`);
  return { ok: true, warning: await revalidateSite(supabase, siteId) };
}

export async function saveSectionProps(
  siteId: string,
  pageId: string,
  sectionId: string,
  props: unknown,
): Promise<ActionResult> {
  const { supabase } = await requireUser();

  const { data: section, error: sectionError } = await supabase
    .from("sections")
    .select("id, section_type")
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

  const { error } = await supabase
    .from("sections")
    .update({ props: parsed.data as never })
    .eq("id", sectionId);
  if (error) {
    if (error.code === "42501") return fail("You don't have permission to edit this section.");
    return fail("Could not save the section.");
  }

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
  const { supabase } = await requireUser();

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

  return { ok: true, warning: await revalidateSite(supabase, siteId) };
}

const publishStatus = z.enum(["draft", "published"]);

export async function setPageStatus(
  siteId: string,
  pageId: string,
  status: "draft" | "published",
): Promise<ActionResult> {
  const { supabase } = await requireUser();
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
  const { supabase } = await requireUser();
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

  revalidatePath(`/sites/${siteId}/pages/${pageId}`);
  revalidatePath(`/sites/${siteId}/pages/${pageId}/sections/${sectionId}`);
  return { ok: true, warning: await revalidateSite(supabase, siteId) };
}
