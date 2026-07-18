import Link from "next/link";
import { siteSummaryColumns } from "@fable/db";
import { requireUser } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { SiteSwitcher } from "@/components/site-switcher";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { supabase, user } = await requireUser();
  const { data: sites } = await supabase
    .from("sites")
    .select(siteSummaryColumns)
    .order("name");

  return (
    <div className="min-h-dvh bg-surface-alt">
      <header className="border-b border-black/10 bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Studio CMS
          </Link>
          <SiteSwitcher
            sites={(sites ?? []).map(({ id, name }) => ({ id, name }))}
          />
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted">{user.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-btn px-2 py-1 text-sm text-muted hover:bg-surface-alt hover:text-primary"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
