import type { Metadata } from "next";
import { draftMode } from "next/headers";
import Link from "next/link";
import { fetchSiteContent, siteUrl } from "@/lib/cms";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await fetchSiteContent();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: site.name, template: `%s` },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { isEnabled: drafts } = await draftMode();
  const { site, pages } = await fetchSiteContent({ drafts });
  const nav = [...pages].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <html lang="en">
      <body className="bg-surface text-primary antialiased">
        {drafts && (
          <div className="bg-amber-400 px-4 py-1.5 text-center text-sm font-semibold text-amber-950">
            Preview mode — drafts and validation errors are visible.{" "}
            <a href="/api/draft/disable" className="underline">
              Exit preview
            </a>
          </div>
        )}
        <header className="border-b border-surface-alt">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
            <Link href="/" className="text-lg font-bold tracking-tight">
              {site.name}
            </Link>
            <nav aria-label="Main">
              <ul className="flex items-center gap-6">
                {nav.map((page) => (
                  <li key={page.slug}>
                    <Link
                      href={page.slug}
                      className="text-sm font-medium text-muted transition-colors hover:text-primary"
                    >
                      {page.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t border-surface-alt">
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted sm:px-6 lg:px-8">
            <p>
              © {new Date().getFullYear()} {site.name}. All rights reserved.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
