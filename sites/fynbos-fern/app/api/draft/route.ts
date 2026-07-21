import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Enables Next.js draft mode (preview): drafts render and invalid sections
 * show error cards. Opened by the admin's Preview button.
 * GET /api/draft?secret=…&path=/about
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const path = url.searchParams.get("path") ?? "/";

  if (!process.env.PREVIEW_SECRET || secret !== process.env.PREVIEW_SECRET) {
    return new Response("Invalid preview secret", { status: 401 });
  }
  // Only same-site relative paths — no open redirect.
  if (!path.startsWith("/") || path.startsWith("//")) {
    return new Response("Invalid path", { status: 400 });
  }

  (await draftMode()).enable();
  redirect(path);
}
