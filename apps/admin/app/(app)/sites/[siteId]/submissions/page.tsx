import { requireUser } from "@/lib/supabase/server";
import { SubmissionCard } from "@/components/submission-card";

export default async function SubmissionsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { supabase } = await requireUser();
  const { data: submissions } = await supabase
    .from("form_submissions")
    .select("id, page_slug, name, email, phone, message, spam, created_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = submissions ?? [];
  const spamCount = rows.filter((row) => row.spam).length;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Form submissions
        {spamCount > 0 && (
          <span className="ml-2 normal-case tracking-normal">
            ({spamCount} flagged as likely spam)
          </span>
        )}
      </h2>
      <ul className="grid gap-3">
        {rows.map((row) => (
          <SubmissionCard key={row.id} siteId={siteId} submission={row} />
        ))}
        {rows.length === 0 && (
          <li className="rounded-card bg-surface px-4 py-6 text-sm text-muted shadow-sm ring-1 ring-black/5">
            No submissions yet. Contact-form entries land here (and are kept
            even if email notification fails).
          </li>
        )}
      </ul>
    </section>
  );
}
