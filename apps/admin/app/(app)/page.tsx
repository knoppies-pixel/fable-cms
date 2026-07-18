import { redirect } from "next/navigation";
import { siteSummaryColumns } from "@fable/db";
import { requireUser } from "@/lib/supabase/server";

export default async function Home() {
  const { supabase } = await requireUser();
  const { data: sites } = await supabase
    .from("sites")
    .select(siteSummaryColumns)
    .order("name")
    .limit(1);

  const first = sites?.[0];
  if (first) redirect(`/sites/${first.id}/pages`);

  return (
    <div className="rounded-card bg-surface p-8 text-center shadow-sm ring-1 ring-black/5">
      <h1 className="text-lg font-semibold">No sites yet</h1>
      <p className="mt-1 text-sm text-muted">
        Your account isn&apos;t a member of any site. Ask a studio admin to add
        you.
      </p>
    </div>
  );
}
