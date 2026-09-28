import { SITE_URL, siteUrl } from '@/lib/site';

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'OrgChai.com';

export const seoDefaults = {
  siteName: SITE_NAME,
  siteUrl: SITE_URL,
  title: `${SITE_NAME}: source-backed employee self-service`,
  description: 'Give employees source-backed answers to handbook, onboarding, and routine IT questions in Slack and on the web.',
  ogImage: siteUrl('/og.png'),
};

export function pageMetadata(opts: {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}) {
  const title = opts.title ? `${opts.title} | ${SITE_NAME}` : seoDefaults.title;
  const description = opts.description || seoDefaults.description;
  const url = siteUrl(opts.path || '/');
  const image = opts.image || seoDefaults.ogImage;

  return {
    title,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: url },
    icons: {
      icon: [
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      ],
      apple: '/apple-touch-icon.png',
    },
    robots: opts.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: 'website' as const,
      locale: 'en_US',
      url,
      siteName: SITE_NAME,
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images: [image],
    },
  };
}
