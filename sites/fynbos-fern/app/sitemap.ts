import type { MetadataRoute } from "next";
import { fetchSiteContent, siteUrl } from "@/lib/cms";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { pages } = await fetchSiteContent();
  const base = siteUrl();
  return pages
    .filter((page) => !page.seo.noindex)
    .map((page) => ({
      url: `${base}${page.slug === "/" ? "" : page.slug}`,
      lastModified: page.published_at ?? undefined,
    }));
}
