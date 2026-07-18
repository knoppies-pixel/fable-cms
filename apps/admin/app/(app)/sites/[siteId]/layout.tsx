import { notFound } from "next/navigation";
import { siteSummaryColumns } from "@fable/db";
import { requireUser } from "@/lib/supabase/server";
import { SiteNav } from "@/components/site-nav";

export default async function SiteLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ siteId: string }>;
}>) {
  const { siteId } = await params;
  const { supabase } = await requireUser();
  // RLS hides sites the user isn't a member of, so this doubles as the
  // membership check. Malformed ids surface as a query error → 404 too.
  const { data: site, error } = await supabase
    .from("sites")
    .select(siteSummaryColumns)
    .eq("id", siteId)
    .maybeSingle();
  if (error || !site) notFound();

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{site.name}</h1>
          <p className="text-sm text-muted">
            {site.domain ?? site.slug}
          </p>
        </div>
        <SiteNav siteId={site.id} />
      </div>
      {children}
    </div>
  );
}
