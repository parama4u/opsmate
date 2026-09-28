import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const hostname = request.headers.get('host')?.split(':')[0].toLowerCase();

  if (hostname === 'www.orgchai.com') {
    const url = request.nextUrl.clone();
    url.hostname = 'orgchai.com';
    url.protocol = 'https:';
    url.port = '';
    return NextResponse.redirect(url, 308);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
