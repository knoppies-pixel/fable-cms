import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/service-client";

export const dynamic = "force-dynamic";

function extractApiKey(request: Request): string | null {
  const headerKey = request.headers.get("x-api-key");
  if (headerKey) return headerKey;
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}

function keyMatchesHash(apiKey: string, storedHash: string): boolean {
  const candidate = createHash("sha256").update(apiKey).digest();
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHash, "hex");
  } catch {
    return false;
  }
  return (
    candidate.length === stored.length && timingSafeEqual(candidate, stored)
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteSlug: string }> },
) {
  const { siteSlug } = await params;
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }
  // Draft content is only served to holders of the site key (the site's
  // server, which uses it to render Next.js draft-mode previews).
  const includeDrafts =
    new URL(request.url).searchParams.get("drafts") === "1";

  const supabase = serviceClient();
  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id, slug, name, domain, tokens, settings, api_key_hash")
    .eq("slug", siteSlug)
    .maybeSingle();

  // Unknown site and bad key both return 401 so the route doesn't leak which
  // site slugs exist.
  if (siteError) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
  if (!site || !keyMatchesHash(apiKey, site.api_key_hash)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  const storageBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media-${site.id}`;
  const media = (mediaRows ?? []).map((row) => ({
    id: row.id,
    url: `${storageBase}/${row.path}`,
    alt: row.alt ?? "",
    width: row.width,
    height: row.height,
  }));

  const { api_key_hash: _apiKeyHash, id: _id, ...publicSite } = site;
  return NextResponse.json({ site: publicSite, pages: pages ?? [], media });
}
