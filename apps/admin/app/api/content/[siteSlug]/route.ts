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

  const { data: pages, error: pagesError } = await supabase
    .from("pages")
    .select(
      "slug, title, seo, published_at, sort_order, sections(id, section_type, props, sort_order)",
    )
    .eq("site_id", site.id)
    .eq("status", "published")
    .eq("sections.status", "published")
    .order("sort_order", { ascending: true })
    .order("sort_order", { ascending: true, referencedTable: "sections" });

  if (pagesError) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  const { api_key_hash: _apiKeyHash, id: _id, ...publicSite } = site;
  return NextResponse.json({ site: publicSite, pages: pages ?? [] });
}
