"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getRegistryEntry } from "@fable/sections";
import { requireUser } from "./supabase/server";

/**
 * All page/section mutations. Every write goes through the caller's own
 * RLS-scoped client, so Postgres policies (site membership, role, column
 * guards) are the enforcement layer — these actions only add input
 * validation and friendly errors on top.
 */

export type ActionResult =
  | { ok: true }
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
  return { ok: true };
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
  return { ok: true };
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
  return { ok: true };
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
  return { ok: true };
}
