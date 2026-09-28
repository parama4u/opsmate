import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';
import { seoPageSlugs } from '@/lib/seo-pages';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl('/'), lastModified: new Date() },
    ...seoPageSlugs.map((slug) => ({ url: siteUrl(`/${slug}`), lastModified: new Date() })),
    ...seoPageSlugs.map((slug) => ({ url: siteUrl(`/ja/${slug}`), lastModified: new Date() })),
    { url: siteUrl('/dashboard'), lastModified: new Date() },
  ];
}
