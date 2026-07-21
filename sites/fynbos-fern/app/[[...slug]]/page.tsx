import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { registerMedia } from "@fable/sections";
import { SectionRenderer } from "@/components/SectionRenderer";
import { fetchSiteContent, segmentsToSlug, slugToSegments } from "@/lib/cms";

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export async function generateStaticParams() {
  const { pages } = await fetchSiteContent();
  return pages.map((page) => ({ slug: slugToSegments(page.slug) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { isEnabled: drafts } = await draftMode();
  const { site, pages } = await fetchSiteContent({ drafts });
  const page = pages.find((p) => p.slug === segmentsToSlug(slug));
  if (!page) return {};
  // seo.title is used verbatim (it may carry its own brand suffix — e.g.
  // migrated SEO titles); the nav-label title only feeds the derived default.
  const metaTitle = page.seo.title || `${page.title} — ${site.name}`;
  return {
    title: metaTitle,
    description: page.seo.description ?? "",
    alternates: { canonical: page.slug },
    robots: page.seo.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: metaTitle,
      description: page.seo.description ?? "",
      url: page.slug,
      siteName: site.name,
      type: "website",
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const { isEnabled: drafts } = await draftMode();
  const { pages, media } = await fetchSiteContent({ drafts });
  const page = pages.find((p) => p.slug === segmentsToSlug(slug));
  if (!page) notFound();

  registerMedia(media);
  return (
    <>
      {page.sections.map((section) => (
        <SectionRenderer key={section.id} section={section} preview={drafts} />
      ))}
    </>
  );
}
