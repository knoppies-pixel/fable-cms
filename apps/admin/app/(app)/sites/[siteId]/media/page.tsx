import { MediaLibrary } from "@/components/media-library";

export default async function MediaPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  // The library is fully client-side: listing, uploads, alt edits and
  // deletes all run through the user's RLS-scoped browser client.
  return <MediaLibrary siteId={siteId} />;
}
