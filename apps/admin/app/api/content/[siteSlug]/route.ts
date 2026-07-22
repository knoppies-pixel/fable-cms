import { NextResponse } from "next/server";
import { authenticateSiteRequest } from "@/lib/site-api-key";
import { serviceClient } from "@/lib/service-client";

export const dynamic = "force-dynamic";

// Resolved at module load so a missing var fails the build/startup loudly
// instead of emitting "undefined/storage/..." media URLs per request.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!SUPABASE_URL) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL (needed for media URLs)");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteSlug: string }> },
) {
  const { siteSlug } = await params;
  // Draft content is only served to holders of the site key (the site's
  // server, which uses it to render Next.js draft-mode previews).
  const includeDrafts =
    new URL(request.url).searchParams.get("drafts") === "1";

  const supabase = serviceClient();
  const auth = await authenticateSiteRequest(supabase, request, siteSlug);
  if (!auth.site) {
    return auth.status === 500
      ? NextResponse.json({ error: "Internal error" }, { status: 500 })
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const site = auth.site;

  let pagesQuery = supabase
    .from("pages")
    .select(
      "slug, title, seo, status, published_at, sort_order, sections(id, section_type, props, sort_order, status)",
    )
    .eq("site_id", site.id)
    .order("sort_order", { ascending: true })
    .order("sort_order", { ascending: true, referencedTable: "sections" });
  if (!includeDrafts) {
    pagesQuery = pagesQuery
      .eq("status", "published")
      .eq("sections.status", "published");
  }
  const { data: pages, error: pagesError } = await pagesQuery;

  if (pagesError) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const { data: mediaRows, error: mediaError } = await supabase
    .from("media")
    .select("id, path, alt, width, height")
    .eq("site_id", site.id);

  if (mediaError) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  // Public bucket URLs — one bucket per site, media-{site_id} (spec §3).
  const storageBase = `${SUPABASE_URL}/storage/v1/object/public/media-${site.id}`;
  const media = (mediaRows ?? []).map((row) => ({
    id: row.id,
    url: `${storageBase}/${row.path}`,
    alt: row.alt ?? "",
    width: row.width,
    height: row.height,
  }));

  const { id: _id, ...publicSite } = site;
  return NextResponse.json({ site: publicSite, pages: pages ?? [], media });
}
