import { requireUser } from "@/lib/supabase/server";

const ACTIVITY_PAGE_SIZE = 100;

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const { supabase } = await requireUser();
  const { data: events } = await supabase
    .from("activity_log")
    .select("id, actor_email, action, summary, created_at")
    .eq("site_id", siteId)
    .order("id", { ascending: false })
    .limit(ACTIVITY_PAGE_SIZE);

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Activity — last {ACTIVITY_PAGE_SIZE} events
      </h2>
      <ul className="overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-black/5">
        {(events ?? []).map((event) => (
          <li
            key={event.id}
            className="flex items-baseline gap-3 border-b border-black/5 px-4 py-3 last:border-b-0"
          >
            <span className="whitespace-nowrap text-xs tabular-nums text-muted">
              {formatWhen(event.created_at)}
            </span>
            <span className="text-sm">{event.summary}</span>
            <span className="ml-auto whitespace-nowrap text-xs text-muted">
              {event.actor_email ?? "system"}
            </span>
          </li>
        ))}
        {(events ?? []).length === 0 && (
          <li className="px-4 py-6 text-sm text-muted">
            No activity yet. Edits, publishes, uploads and deletions will show
            up here — who did what, and when.
          </li>
        )}
      </ul>
    </section>
  );
}
