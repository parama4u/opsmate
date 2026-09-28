const DEFAULT_SITE_URL = 'https://orgchai.com';

function configuredSiteUrl(): string {
  const candidate = process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_SITE_URL;

  try {
    return new URL(candidate).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export const SITE_URL = configuredSiteUrl();

export function siteUrl(path = ''): string {
  return new URL(path, SITE_URL).toString();
}
