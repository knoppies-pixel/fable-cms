import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * On-demand revalidation, called by the admin on publish/save so content
 * changes go live in seconds without a redeploy (spec §6).
 * POST /api/revalidate?path=/about — secret via x-revalidate-secret header
 * (or ?secret= for manual use). No paths = revalidate every route.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const secret =
    request.headers.get("x-revalidate-secret") ?? url.searchParams.get("secret");

  // Fail closed: an unset REVALIDATE_SECRET rejects everything.
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const paths = url.searchParams
    .getAll("path")
    .filter((path) => path.startsWith("/") && !path.startsWith("//"));

  // The content fetch is tagged; purging it stales every page's data.
  // ("max" = Next 16's expire-immediately profile, the classic behavior.)
  revalidateTag("cms-content", "max");
  if (paths.length > 0) {
    for (const path of paths) revalidatePath(path);
  } else {
    // Layout-wide purge: reorders/publishes affect nav + multiple pages.
    revalidatePath("/", "layout");
  }

  return NextResponse.json({ revalidated: true, paths, now: Date.now() });
}
